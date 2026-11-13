import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {initializeThirdPlan,thirdPlan} from '../server/third-plan.mjs';
import {parseBalancePricing,balancePricedAmount} from '../server/balance-pricing.mjs';
test('balance percentage accepts 0.01 through 100, exact cent bounds, and rejects invalid ranges',()=>{
 assert.deepEqual(parseBalancePricing({minPercent:10,maxPercent:90}),{minPercent:10,maxPercent:90});
 assert.equal(balancePricedAmount(10000,{minPercent:.01,maxPercent:.01}),1);
 assert.equal(balancePricedAmount(10000,{minPercent:100,maxPercent:100}),10000);
 for(const minPercent of [0,-1,100.01,'0.001',NaN,Infinity])assert.throws(()=>parseBalancePricing({minPercent,maxPercent:100}));
 assert.throws(()=>parseBalancePricing({minPercent:90,maxPercent:10}));
 assert.throws(()=>balancePricedAmount(1,{minPercent:.01,maxPercent:.01}));
 for(let i=0;i<100;i++){const n=balancePricedAmount(10001,{minPercent:10,maxPercent:90});assert.ok(n>=1000&&n<=9001);}
});
test('published database works seed the next round, paused and old-stage works are excluded, current round persists',()=>{
 const db=new DatabaseSync(':memory:');try{
 db.exec('CREATE TABLE tasks(id TEXT PRIMARY KEY,stage INTEGER,active INTEGER,created_at TEXT);CREATE TABLE assignments(id TEXT PRIMARY KEY,status TEXT,created_at TEXT,reviewed_at TEXT)');
 initializeThirdPlan(db);db.exec("INSERT INTO tasks VALUES('first',3,1,'1'),('old',1,1,'1'),('paused',3,0,'1')");
 thirdPlan(db,'a','2026-11-03T12:00:00Z');
 assert.deepEqual(db.prepare('SELECT DISTINCT story_id FROM third_plan_items').all().map(r=>r.story_id),['task:first']);
 db.exec("INSERT INTO tasks VALUES('new',3,1,'2')");
 thirdPlan(db,'a','2026-11-03T13:00:00Z');
 assert.equal(db.prepare("SELECT COUNT(*) n FROM third_plan_items WHERE story_id='task:new'").get().n,0);
 for(let i=0;i<50;i++){db.prepare('INSERT INTO assignments VALUES(?,?,?,?)').run('a'+i,'completed','2026-11-03T14:00:00Z','2026-11-03T14:00:00Z');db.prepare('UPDATE third_plan_items SET assignment_id=? WHERE owner_id=? AND position=?').run('a'+i,'a',i);}
 thirdPlan(db,'a','2026-11-04T12:00:00Z');
 assert.deepEqual(db.prepare('SELECT DISTINCT story_id FROM third_plan_items WHERE position>=50 ORDER BY story_id').all().map(r=>r.story_id),['task:first','task:new']);
 }finally{db.close();}
});
