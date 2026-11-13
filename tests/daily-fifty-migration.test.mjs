import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {initializeThirdPlan,thirdPlan,peekThirdPlan} from '../server/third-plan.mjs';

test('30-to-50 upgrade retains historical assignment bindings, current slot positions and pending quotes across repeated startups',()=>{
 const db=new DatabaseSync(':memory:');
 try{
 db.exec(`CREATE TABLE assignments(id TEXT PRIMARY KEY,status TEXT,created_at TEXT,reviewed_at TEXT);
 CREATE TABLE third_plans(owner_id TEXT PRIMARY KEY,batch INTEGER,opened_day TEXT,time_zone TEXT,start_position INTEGER);
 CREATE TABLE third_plan_items(owner_id TEXT,position INTEGER,story_id TEXT,assignment_id TEXT,PRIMARY KEY(owner_id,position));
 CREATE TABLE stage_task_offers(id TEXT PRIMARY KEY,owner_id TEXT,pricing TEXT);
 INSERT INTO third_plans VALUES('a',1,'2026-11-03','UTC',0);
 INSERT INTO stage_task_offers VALUES('pending','a','{"amount":12345,"commission":234,"premium":true}');`);
 for(let i=0;i<60;i++){
  const id=i<35?'a'+i:null;
  if(id)db.prepare('INSERT INTO assignments VALUES(?,?,?,?)').run(id,'completed','2026-11-03T12:00:00Z','2026-11-03T12:00:00Z');
  db.prepare('INSERT INTO third_plan_items VALUES(?,?,?,?)').run('a',i,'story-'+i,id);
 }
 const assignments=db.prepare('SELECT * FROM assignments ORDER BY id').all(),quote=db.prepare('SELECT * FROM stage_task_offers').get();
 initializeThirdPlan(db);let plan=thirdPlan(db,'a','2026-11-03T13:00:00Z');
 assert.equal(plan.batch,2);assert.equal(plan.dailyLimit,50);assert.equal(plan.dailyCompleted,5);assert.equal(plan.nextPosition,55);assert.equal(plan.planSequence,6);
 assert.equal(db.prepare('SELECT assignment_id FROM third_plan_items WHERE owner_id=? AND position=50').get('a').assignment_id,'a30');
 assert.equal(db.prepare('SELECT COUNT(*) n FROM third_plan_items WHERE owner_id=? AND position>=50 AND position<100').get('a').n,50);
 assert.deepEqual(db.prepare('SELECT * FROM assignments ORDER BY id').all(),assignments);assert.deepEqual(db.prepare('SELECT * FROM stage_task_offers').get(),quote);
 const items=db.prepare('SELECT * FROM third_plan_items ORDER BY position').all();initializeThirdPlan(db);assert.deepEqual(db.prepare('SELECT * FROM third_plan_items ORDER BY position').all(),items);assert.equal(peekThirdPlan(db,'a').dailyCompleted,5);
 }finally{db.close();}
});
test('a formerly completed 30-slot current round expands to 50 without advancing or settling again',()=>{
 const db=new DatabaseSync(':memory:');try{
 db.exec(`CREATE TABLE assignments(id TEXT PRIMARY KEY,status TEXT,created_at TEXT,reviewed_at TEXT);CREATE TABLE third_plans(owner_id TEXT PRIMARY KEY,batch INTEGER,opened_day TEXT,time_zone TEXT,start_position INTEGER);CREATE TABLE third_plan_items(owner_id TEXT,position INTEGER,story_id TEXT,assignment_id TEXT,PRIMARY KEY(owner_id,position));INSERT INTO third_plans VALUES('b',0,'2026-11-03','UTC',0);`);
 for(let i=0;i<30;i++){db.prepare('INSERT INTO assignments VALUES(?,?,?,?)').run('b'+i,'completed','2026-11-03T12:00:00Z','2026-11-03T12:00:00Z');db.prepare('INSERT INTO third_plan_items VALUES(?,?,?,?)').run('b',i,'story-'+i,'b'+i);}
 initializeThirdPlan(db);const p=thirdPlan(db,'b','2026-11-04T12:00:00Z');assert.equal(p.batch,1);assert.equal(p.dailyCompleted,30);assert.equal(p.dailyLimit,50);assert.equal(p.waiting,false);assert.equal(p.nextPosition,30);assert.equal(db.prepare('SELECT COUNT(*) n FROM assignments').get().n,30);
 }finally{db.close();}
});
