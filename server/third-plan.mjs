import {initializeCustomerClock,customerTimeZone,customerLocalDate,localWallTime,nextCustomerFive} from './customer-clock.mjs';
import {readFileSync} from 'node:fs';
import {randomInt} from 'node:crypto';
const stories=JSON.parse(readFileSync(new URL('../src/studio/storyCatalog.json',import.meta.url),'utf8'));
export const DAILY_TASK_LIMIT=50;
export function initializeThirdPlan(db){
 initializeCustomerClock(db);
 db.exec(`CREATE TABLE IF NOT EXISTS third_plans(owner_id TEXT PRIMARY KEY,batch INTEGER NOT NULL DEFAULT 0,opened_day TEXT NOT NULL,time_zone TEXT,start_position INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS third_plan_items(owner_id TEXT NOT NULL,position INTEGER NOT NULL,story_id TEXT NOT NULL,assignment_id TEXT REFERENCES assignments(id),PRIMARY KEY(owner_id,position));`);
 // Upgrade the position stride once, preserving every assignment and configured day/slot.
 db.exec('CREATE TABLE IF NOT EXISTS third_plan_settings(id INTEGER PRIMARY KEY CHECK(id=1),task_limit INTEGER NOT NULL)');
 const configured=db.prepare('SELECT task_limit FROM third_plan_settings WHERE id=1').get();
 if(!configured){
  db.exec('SAVEPOINT upgrade_daily_limit');
  try{
   const owners=db.prepare('SELECT owner_id,batch,start_position FROM third_plans').all();
   if(owners.length){
    // Negative temporary positions cannot collide with the existing nonnegative primary keys.
    db.exec('UPDATE third_plan_items SET position=-position-1');
    db.exec('UPDATE third_plan_items SET position=CAST((-position-1)/30 AS INTEGER)*50+((-position-1)%30)');
    db.exec('UPDATE third_plans SET start_position=CAST(start_position/30 AS INTEGER)*50+(start_position%30)');
   }
   db.prepare('INSERT INTO third_plan_settings VALUES(1,?)').run(DAILY_TASK_LIMIT);
   db.exec('RELEASE upgrade_daily_limit');
  }catch(e){db.exec('ROLLBACK TO upgrade_daily_limit; RELEASE upgrade_daily_limit');throw e;}
 }

}
function ensureBatch(db,owner,batch){
 const start=batch*DAILY_TASK_LIMIT,existing=db.prepare('SELECT position,story_id FROM third_plan_items WHERE owner_id=? AND position>=? AND position<?').all(owner,start,start+DAILY_TASK_LIMIT),positions=new Set(existing.map(i=>i.position));
 // Existing rounds are immutable; catalog changes only affect missing/new positions.
 if(positions.size===DAILY_TASK_LIMIT)return;
 const hasCatalog=!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='tasks'").get();
 const catalog=hasCatalog?db.prepare("SELECT id FROM tasks WHERE stage=3 AND active=1 ORDER BY created_at,id").all().map(t=>'task:'+t.id):stories.map(s=>s.id);
 if(!catalog.length)throw new Error('当前暂无已上架作品，请联系平台');
 const used=new Set(existing.map(i=>i.story_id)),insert=db.prepare('INSERT OR IGNORE INTO third_plan_items(owner_id,position,story_id,assignment_id) VALUES(?,?,?,NULL)');let pool=[];
 for(let i=0;i<DAILY_TASK_LIMIT;i++){
  if(positions.has(start+i))continue;
  if(!pool.length){pool=catalog.filter(id=>!used.has(id));if(!pool.length)pool=[...catalog];for(let j=pool.length-1;j>0;j--){const k=randomInt(j+1);[pool[j],pool[k]]=[pool[k],pool[j]];}}
  const selected=pool.pop();insert.run(owner,start+i,selected);used.add(selected);
 }
}
export function thirdPlan(db,owner,at=new Date(),{totals=true}={}){
 db.exec('SAVEPOINT daily_plan');
 try{
  let plan=db.prepare('SELECT * FROM third_plans WHERE owner_id=?').get(owner);
  const zone=customerTimeZone(db,owner),now=typeof at==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(at)?localWallTime(at,12,zone):new Date(at);
  if(!plan){plan={batch:0,opened_day:customerLocalDate(now,zone),time_zone:zone,start_position:0};db.prepare('INSERT INTO third_plans(owner_id,batch,opened_day,time_zone,start_position) VALUES(?,?,?,?,0)').run(owner,0,plan.opened_day,zone);}
  ensureBatch(db,owner,plan.batch);
  let state=describe(db,owner,plan,now,{totals});
  if(state.waiting&&now>=new Date(state.nextUnlockAt)){
   plan={...plan,batch:plan.batch+1,opened_day:customerLocalDate(now,zone),time_zone:zone};
   db.prepare('UPDATE third_plans SET batch=?,opened_day=?,time_zone=? WHERE owner_id=?').run(plan.batch,plan.opened_day,zone,owner);
   ensureBatch(db,owner,plan.batch);state=describe(db,owner,plan,now,{totals});
  }
  db.exec('RELEASE daily_plan');return state;
 }catch(e){db.exec('ROLLBACK TO daily_plan; RELEASE daily_plan');throw e;}
}
function describe(db,owner,plan,now,{totals=true}={}){
 const start=plan.batch*DAILY_TASK_LIMIT,items=db.prepare('SELECT i.*,a.status,a.created_at,a.reviewed_at FROM third_plan_items i LEFT JOIN assignments a ON a.id=i.assignment_id WHERE i.owner_id=? AND i.position>=? AND i.position<? ORDER BY i.position').all(owner,start,start+DAILY_TASK_LIMIT);
 const completed=items.filter(i=>i.status==='completed').length,claimed=items.filter(i=>i.status&&i.status!=='cancelled').length,waiting=completed===DAILY_TASK_LIMIT;
 const zone=plan.time_zone||customerTimeZone(db,owner),nextUnlockAt=waiting?nextCustomerFive(new Date(Math.max(...items.map(i=>new Date(i.reviewed_at||i.created_at).getTime()))),zone):null;
 const next=items.find(i=>i.status!=='completed');
 return {dailyClaimed:claimed,dailyCompleted:completed,dailyLimit:DAILY_TASK_LIMIT,day:plan.opened_day,today:customerLocalDate(now,zone),batch:plan.batch+1,days:plan.batch+1,timeZone:zone,nextUnlockAt,total:(plan.batch+1)*DAILY_TASK_LIMIT,totalCompleted:totals?db.prepare("SELECT COUNT(*) n FROM third_plan_items i JOIN assignments a ON a.id=i.assignment_id WHERE i.owner_id=? AND a.status='completed'").get(owner).n:undefined,completed,claimed,limit:DAILY_TASK_LIMIT,quotas:Array(plan.batch+1).fill(DAILY_TASK_LIMIT),waiting,complete:false,nextStoryId:next?.story_id||null,nextPosition:next?.position??null,planSequence:next?next.position-start+1:null};
}
export function peekThirdPlan(db,owner,now=new Date(),options){const plan=db.prepare('SELECT * FROM third_plans WHERE owner_id=?').get(owner);return plan?describe(db,owner,plan,new Date(now),options):null;}
export function bindThirdPlan(db,owner,assignmentId){
 const state=thirdPlan(db,owner);if(state.waiting||state.nextPosition===null)throw new Error('No available task in the current round');
 const row=db.prepare('SELECT a.status FROM third_plan_items i LEFT JOIN assignments a ON a.id=i.assignment_id WHERE i.owner_id=? AND i.position=?').get(owner,state.nextPosition);
 if(row?.status&&row.status!=='cancelled')throw new Error('Current task is still in progress');
 db.prepare('UPDATE third_plan_items SET assignment_id=? WHERE owner_id=? AND position=?').run(assignmentId,owner,state.nextPosition);
}
