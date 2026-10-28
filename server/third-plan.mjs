import {initializeCustomerClock,customerTimeZone,customerLocalDate,localWallTime,nextCustomerFive} from './customer-clock.mjs';
import {readFileSync} from 'node:fs';
import {randomInt} from 'node:crypto';
import {shanghaiDay} from './time.mjs';
const stories=JSON.parse(readFileSync(new URL('../src/studio/storyCatalog.json',import.meta.url),'utf8'));
export function initializeThirdPlan(db){
 initializeCustomerClock(db);
 db.exec(`CREATE TABLE IF NOT EXISTS third_plans(owner_id TEXT PRIMARY KEY,batch INTEGER NOT NULL DEFAULT 0,opened_day TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS third_plan_items(owner_id TEXT NOT NULL,position INTEGER NOT NULL,story_id TEXT NOT NULL,assignment_id TEXT REFERENCES assignments(id),PRIMARY KEY(owner_id,position));`);
 if(!db.prepare('PRAGMA table_info(third_plans)').all().some(c=>c.name==='time_zone'))db.exec('ALTER TABLE third_plans ADD COLUMN time_zone TEXT');
 if(!db.prepare('PRAGMA table_info(third_plans)').all().some(c=>c.name==='start_position'))db.exec('ALTER TABLE third_plans ADD COLUMN start_position INTEGER NOT NULL DEFAULT 0');
 if(db.prepare("SELECT sql FROM sqlite_master WHERE name='third_plan_items'").get().sql.includes('UNIQUE(owner_id,story_id)'))db.exec(`BEGIN; ALTER TABLE third_plan_items RENAME TO third_plan_items_old;
 CREATE TABLE third_plan_items(owner_id TEXT NOT NULL,position INTEGER NOT NULL,story_id TEXT NOT NULL,assignment_id TEXT REFERENCES assignments(id),PRIMARY KEY(owner_id,position));
 INSERT INTO third_plan_items SELECT * FROM third_plan_items_old; DROP TABLE third_plan_items_old; COMMIT;`);
}
// Calendar changes never discard unfinished work. Only reviewed completions unlock a later batch.
export function thirdPlan(db,owner,at=new Date()){
 db.exec('SAVEPOINT daily_plan');
 try{const state=readThirdPlan(db,owner,at);db.exec('RELEASE daily_plan');return state;}
 catch(error){db.exec('ROLLBACK TO daily_plan; RELEASE daily_plan');throw error;}
}
function readThirdPlan(db,owner,at){
 const now=typeof at==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(at)?localWallTime(at,12,customerTimeZone(db,owner)):new Date(at);const today=customerLocalDate(now,customerTimeZone(db,owner));
 let plan=db.prepare('SELECT * FROM third_plans WHERE owner_id=?').get(owner);
 if(!plan){
  const previous=db.prepare(`SELECT a.id,a.status,t.title FROM assignments a JOIN assignment_terms f ON f.assignment_id=a.id JOIN tasks t ON t.id=a.task_id WHERE a.owner_id=? AND f.stage=3 AND a.status!='cancelled' ORDER BY CASE WHEN a.status='completed' THEN 0 ELSE 1 END,a.created_at`).all(owner);
  const mapped=new Map();for(const a of previous){const story=stories.find(s=>s.title===a.title);if(story&&!mapped.has(story.id))mapped.set(story.id,a.id);}
  let rest=stories.filter(s=>!mapped.has(s.id)).map(s=>s.id);
  for(let i=rest.length-1;i>0;i--){const j=randomInt(i+1);[rest[i],rest[j]]=[rest[j],rest[i]];}
  // Keep a revealed, unpaid story at the front when upgrading an existing customer.
  if(db.prepare("SELECT 1 FROM sqlite_master WHERE name='stage_task_offers'").get()){
   const row=db.prepare('SELECT story FROM stage_task_offers WHERE owner_id=? AND stage=3 AND assignment_id IS NULL AND retired=0').get(owner);
   const id=row?.story?JSON.parse(row.story).id:null;if(rest.includes(id))rest=[id,...rest.filter(s=>s!==id)];
  }
  const order=[...mapped.keys(),...rest];
  const completed=previous.filter(a=>a.status==='completed'&&[...mapped.values()].includes(a.id)).length;
  const batch=Math.min(4,Math.floor(completed/Math.ceil(stories.length/5)));
  db.prepare('INSERT INTO third_plans(owner_id,batch,opened_day) VALUES(?,?,?)').run(owner,batch,today);
  const insert=db.prepare('INSERT INTO third_plan_items(owner_id,position,story_id,assignment_id) VALUES(?,?,?,?)');
  order.forEach((id,i)=>insert.run(owner,i,id,mapped.get(id)||null));
  plan={batch,opened_day:today};
 }
 // Expand legacy plans once; preserve the current batch boundary and revealed story.
 const existing=db.prepare('SELECT * FROM third_plan_items WHERE owner_id=? ORDER BY position').all(owner);
 if(existing.length===stories.length){
  const start=plan.batch*Math.ceil(stories.length/5);

  const insert=db.prepare('INSERT INTO third_plan_items(owner_id,position,story_id,assignment_id) VALUES(?,?,?,NULL)');
  existing.forEach((item,i)=>insert.run(owner,existing.length+i,item.story_id));
  db.prepare('UPDATE third_plans SET batch=0,start_position=? WHERE owner_id=?').run(start,owner);
  plan={...plan,batch:0,start_position:start};
 }
 if(!plan.time_zone){plan.time_zone=customerTimeZone(db,owner);db.prepare('UPDATE third_plans SET time_zone=? WHERE owner_id=?').run(plan.time_zone,owner);}
 return describePlan(db,owner,plan,now,true);
}
function describePlan(db,owner,plan,now,mutate){
 const items=db.prepare('SELECT i.*,a.status,a.created_at,a.reviewed_at FROM third_plan_items i LEFT JOIN assignments a ON a.id=i.assignment_id WHERE i.owner_id=? ORDER BY i.position').all(owner);
 const size=10,start=(plan.start_position||0)+plan.batch*size,end=Math.min(items.length,start+size),current=items.slice(start,end),zone=plan.time_zone||customerTimeZone(db,owner);
 const completed=current.filter(i=>i.status==='completed').length,complete=items.length>0&&items.every(i=>i.status==='completed');
 let nextUnlockAt=null;
 if(current.length&&completed===current.length&&!complete){const times=current.map(i=>i.reviewed_at||i.created_at||plan.opened_day).map(v=>/^\d{4}-\d{2}-\d{2}$/.test(v)?localWallTime(v,12,zone).getTime():new Date(v).getTime());nextUnlockAt=nextCustomerFive(new Date(Math.max(...times)),zone);
  if(now.getTime()>=new Date(nextUnlockAt).getTime()){const nextZone=customerTimeZone(db,owner),next={...plan,batch:plan.batch+1,opened_day:customerLocalDate(now,nextZone),time_zone:nextZone};if(mutate)db.prepare('UPDATE third_plans SET batch=?,opened_day=?,time_zone=? WHERE owner_id=?').run(next.batch,next.opened_day,next.time_zone,owner);return describePlan(db,owner,next,now,mutate);}}
 const next=current.find(i=>i.status!=='completed'),claimed=current.filter(i=>i.status&&i.status!=='cancelled').length;
 return {dailyClaimed:claimed,dailyCompleted:completed,dailyLimit:current.length,day:plan.opened_day,today:customerLocalDate(now,zone),batch:plan.batch+1,days:5,timeZone:zone,nextUnlockAt,total:items.length,totalCompleted:items.filter(i=>i.status==='completed').length,completed,claimed,limit:current.length,quotas:Array.from({length:5},(_,n)=>Math.max(0,Math.min(size,items.length-n*size))),waiting:completed===current.length&&!complete,complete,nextStoryId:next?.story_id||null,nextPosition:next?.position??null,planSequence:next?next.position-start+1:null};
}
export function peekThirdPlan(db,owner,now=new Date()){const plan=db.prepare('SELECT * FROM third_plans WHERE owner_id=?').get(owner);return plan?describePlan(db,owner,plan,new Date(now),false):null;}
export function bindThirdPlan(db,owner,assignmentId){
 const state=thirdPlan(db,owner);if(state.nextPosition===null)throw new Error('No available third-stage story');const row=db.prepare('SELECT a.status FROM third_plan_items i LEFT JOIN assignments a ON a.id=i.assignment_id WHERE i.owner_id=? AND i.position=?').get(owner,state.nextPosition);if(row?.status&&row.status!=='cancelled')throw new Error('Current third-stage assignment is still in progress');db.prepare('UPDATE third_plan_items SET assignment_id=? WHERE owner_id=? AND position=?').run(assignmentId,owner,state.nextPosition);
}
