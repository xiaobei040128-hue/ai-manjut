import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createStore} from '../server/store.mjs';
import {thirdPlan,initializeThirdPlan} from '../server/third-plan.mjs';
import {syncStoryTasks} from '../server/sync-story-tasks.mjs';
const taskInput={title:'Murder at 30,000 Feet',description:'Story fixture',stage:3,platform:'TikTok',language:'英文',genre:'剧情',deposit:'10',posts:1,episodes:1,slots:100,cover:'/art/hero-v2.webp'};
test('five batches persist across midnight, wait for review, retry cancellations and finish without a reset',()=>{
 const s=createStore(':memory:');s.setCommissionRate('5');try{
  const db=s.db,t=s.createTask(taskInput),owner='plan-test';
  let state=thirdPlan(db,owner,'2026-10-25');assert.deepEqual(state.quotas,[10,10,10,10,8]);assert.equal(state.total,48);
  const first=state.nextStoryId;
  assert.equal(thirdPlan(db,owner,'2026-10-26').nextStoryId,first);assert.equal(thirdPlan(db,owner,'2026-10-26').batch,1);
  function attach(id,status){db.prepare("INSERT INTO assignments(id,task_id,status,created_at,deadline,owner_id) VALUES(?,?,?,'2026-10-25','2026-11-01',?)").run(id,t.id,status,owner);db.prepare('UPDATE third_plan_items SET assignment_id=? WHERE owner_id=? AND position=?').run(id,owner,thirdPlan(db,owner,'2026-10-25').nextPosition);}
  attach('cancelled','cancelled');assert.equal(thirdPlan(db,owner,'2026-10-25').nextStoryId,first);assert.equal(thirdPlan(db,owner,'2026-10-25').claimed,0);
  attach('review','review');assert.equal(thirdPlan(db,owner,'2026-10-26').completed,0);assert.equal(thirdPlan(db,owner,'2026-10-26').batch,1);
  db.prepare("UPDATE assignments SET status='completed' WHERE id='review'").run();
  for(let i=1;i<10;i++)attach('first-'+i,'completed');
  state=thirdPlan(db,owner,'2026-10-25');assert.equal(state.waiting,true);assert.equal(state.batch,1);
  state=thirdPlan(db,owner,'2026-10-27');assert.equal(state.batch,2);assert.equal(state.totalCompleted,10);assert.equal(state.day,'2026-10-27');
  // Complete later batches on their opening day; no extra batch may open that same day.
  for(let batch=2;batch<=5;batch++){
   const day=`2026-10-${25+batch}`;
   state=thirdPlan(db,owner,day);
   for(const item of db.prepare('SELECT * FROM third_plan_items WHERE owner_id=? AND position>=? AND position<?').all(owner,(batch-1)*10,Math.min(48,batch*10))){
    const id='item-'+item.position;db.prepare("INSERT INTO assignments(id,task_id,status,created_at,deadline,owner_id) VALUES(?,?,'completed',?,?,?)").run(id,t.id,day,day,owner);db.prepare('UPDATE third_plan_items SET assignment_id=? WHERE owner_id=? AND position=?').run(id,owner,item.position);
   }
   state=thirdPlan(db,owner,day);assert.equal(state.batch,batch);
  }
  assert.equal(state.complete,true);assert.equal(state.totalCompleted,48);assert.equal(thirdPlan(db,owner,'2026-11-10').complete,true);assert.equal(thirdPlan(db,owner,'2026-11-10').nextStoryId,null);
  assert.equal(thirdPlan(db,'another-user','2026-10-25').totalCompleted,0);
 }finally{s.close();}
});
test('catalog upgrade is idempotent and preserves original commercial settings and existing records',()=>{
 const s=createStore(':memory:');s.setCommissionRate('5');try{
  const old=s.createTask(taskInput);s.createTask({...taskInput,stage:1,title:'Original newcomer'});
  syncStoryTasks(s);syncStoryTasks(s);
  assert.equal(s.allTasks().filter(t=>t.stage===3).length,24);
  assert.equal(s.allTasks().filter(t=>t.title==='The Lawyer Who Never Lost'&&t.stage===1).length,1);
  assert.equal(s.getTask(old.id).deposit,1000);
  assert.equal(s.allTasks().find(t=>t.title==='The City Under the Sea').deposit,1000);
 }finally{s.close();}
});
test('claim endpoint enforces the batch and cancellations retain the current story without consuming a completion',()=>{
 const s=createStore(':memory:');s.setCommissionRate('5');try{
  const t=s.createTask({...taskInput,deposit:'0'}),first=s.dispatchStatus().nextStoryId;
  let a=s.claim(t.id);assert.equal(s.claim(t.id).id,a.id);s.cancel(a.id);
  assert.equal(s.dispatchStatus().nextStoryId,first);assert.equal(s.dispatchStatus().claimed,0);
  for(let n=0;n<10;n++){
   a=s.claim(t.id);const upload=s.addUpload(a.id,{name:'proof.png',mime:'image/png',size:1,path:'/uploads/test-'+n+'.png'});
   s.submit(a.id,{links:['https://example.invalid/proof/'+n],uploadIds:[upload.id]});
   assert.equal(s.dispatchStatus().completed,n);s.review(a.id,{decision:'approve'});
  }
  assert.equal(s.dispatchStatus().waiting,true);assert.throws(()=>s.claim(t.id),e=>e.status===409);
  s.db.prepare("UPDATE third_plans SET opened_day='2000-01-01' WHERE owner_id='legacy'").run();
  assert.equal(s.dispatchStatus().batch,1); // An opening-date edit cannot bypass the completion-based unlock.
  s.db.prepare("UPDATE assignments SET reviewed_at='2000-01-01T12:00:00Z' WHERE owner_id='legacy' AND status='completed'").run();
  assert.equal(s.dispatchStatus().batch,2);assert.equal(s.dispatchStatus().completed,0);assert.equal(s.dispatchStatus().totalCompleted,10);assert.equal(s.dispatchStatus().dailyClaimed,0);
  assert.ok(s.claim(t.id).id);
 }finally{s.close();}
});

test('legacy unique-story schema expands once and preserves current progress',()=>{
 const s=createStore(':memory:');try{
  const db=s.db;
  db.exec('DROP TABLE third_plan_items; CREATE TABLE third_plan_items(owner_id TEXT NOT NULL,position INTEGER NOT NULL,story_id TEXT NOT NULL,assignment_id TEXT REFERENCES assignments(id),PRIMARY KEY(owner_id,position),UNIQUE(owner_id,story_id));');
  const catalog=JSON.parse(readFileSync(new URL('../src/studio/storyCatalog.json',import.meta.url),'utf8'));
  db.prepare('INSERT INTO third_plans(owner_id,batch,opened_day) VALUES(?,2,?)').run('legacy-upgrade','2026-10-25');
  catalog.forEach((story,i)=>db.prepare('INSERT INTO third_plan_items VALUES(?,?,?,NULL)').run('legacy-upgrade',i,story.id));
  initializeThirdPlan(db);
  const state=thirdPlan(db,'legacy-upgrade','2026-10-25');
  assert.equal(state.total,48);assert.equal(state.nextPosition,10);assert.equal(state.nextStoryId,catalog[10].id);
  assert.equal(thirdPlan(db,'legacy-upgrade','2026-10-26').nextPosition,10);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM third_plan_items WHERE owner_id=?').get('legacy-upgrade').n,48);
  const counts=db.prepare('SELECT COUNT(*) n FROM third_plan_items WHERE owner_id=? GROUP BY story_id').all('legacy-upgrade');assert.ok(counts.every(row=>row.n===2));
 }finally{s.close();}
});
