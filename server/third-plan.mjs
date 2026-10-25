import {readFileSync} from 'node:fs';
import {randomInt} from 'node:crypto';
import {shanghaiDay} from './time.mjs';
const stories=JSON.parse(readFileSync(new URL('../src/studio/storyCatalog.json',import.meta.url),'utf8'));
export function initializeThirdPlan(db){
 db.exec(`CREATE TABLE IF NOT EXISTS third_plans(owner_id TEXT PRIMARY KEY,batch INTEGER NOT NULL DEFAULT 0,opened_day TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS third_plan_items(owner_id TEXT NOT NULL,position INTEGER NOT NULL,story_id TEXT NOT NULL,assignment_id TEXT REFERENCES assignments(id),PRIMARY KEY(owner_id,position),UNIQUE(owner_id,story_id));`);
}
// Calendar changes never discard unfinished work. Only reviewed completions unlock a later batch.
export function thirdPlan(db,owner,today=shanghaiDay()){
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
 const items=db.prepare('SELECT i.*,a.status,a.reviewed_at FROM third_plan_items i LEFT JOIN assignments a ON a.id=i.assignment_id WHERE i.owner_id=? ORDER BY i.position').all(owner);
 const size=Math.ceil(items.length/5),start=plan.batch*size,end=Math.min(items.length,start+size),current=items.slice(start,end);
 const completed=current.filter(i=>i.status==='completed').length;
 const complete=items.every(i=>i.status==='completed');
 if(completed===current.length&&!complete&&today>plan.opened_day){
  db.prepare('UPDATE third_plans SET batch=batch+1,opened_day=? WHERE owner_id=?').run(today,owner);
  return thirdPlan(db,owner,today);
 }
 const next=current.find(i=>i.status!=='completed');
 return {day:plan.opened_day,today,batch:plan.batch+1,days:5,total:items.length,totalCompleted:items.filter(i=>i.status==='completed').length,completed,claimed:current.filter(i=>i.status&&i.status!=='cancelled').length,limit:current.length,quotas:Array.from({length:5},(_,n)=>Math.max(0,Math.min(size,items.length-n*size))),waiting:completed===current.length&&!complete,complete,nextStoryId:next?.story_id||null,nextPosition:next?.position??null};
}
export function bindThirdPlan(db,owner,assignmentId){
 const state=thirdPlan(db,owner);
 if(state.nextPosition===null)throw new Error('No available third-stage story');
 const row=db.prepare('SELECT a.status FROM third_plan_items i LEFT JOIN assignments a ON a.id=i.assignment_id WHERE i.owner_id=? AND i.position=?').get(owner,state.nextPosition);
 if(row?.status&&row.status!=='cancelled')throw new Error('Current third-stage assignment is still in progress');
 db.prepare('UPDATE third_plan_items SET assignment_id=? WHERE owner_id=? AND position=?').run(assignmentId,owner,state.nextPosition);
}
