import {readFileSync} from 'node:fs';
import {createTaskBalance} from './task-balance.mjs';
import {shanghaiDay} from './time.mjs';
const stories=JSON.parse(readFileSync(new URL('../src/studio/storyCatalog.json',import.meta.url),'utf8'));
import {randomInt,randomUUID} from 'node:crypto';
import {AppError} from './store.mjs';

// Third-stage draws persist both the personal reveal and its balance reservation.
export function createStageDispatch(store){
 const db=store.db,balance=createTaskBalance(store);
 db.exec(`CREATE TABLE IF NOT EXISTS stage_task_offers(
  id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,stage INTEGER NOT NULL,task_id TEXT NOT NULL,
  assignment_id TEXT,created_at TEXT NOT NULL);`);
 if(!db.prepare('PRAGMA table_info(stage_task_offers)').all().some(c=>c.name==='retired')){db.exec('ALTER TABLE stage_task_offers ADD COLUMN retired INTEGER NOT NULL DEFAULT 0; DROP INDEX IF EXISTS stage_offer_pending;');}
 if(!db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND name='stage_offer_pending'").get()?.sql.includes('retired'))db.exec('DROP INDEX IF EXISTS stage_offer_pending');
 db.exec('CREATE UNIQUE INDEX IF NOT EXISTS stage_offer_pending ON stage_task_offers(owner_id) WHERE assignment_id IS NULL AND retired=0');
 if(!db.prepare('PRAGMA table_info(stage_task_offers)').all().some(c=>c.name==='story'))db.exec('ALTER TABLE stage_task_offers ADD COLUMN story TEXT');
 db.exec('CREATE TABLE IF NOT EXISTS third_story_queues(owner_id TEXT NOT NULL,day TEXT NOT NULL,story_order TEXT NOT NULL,PRIMARY KEY(owner_id,day))');
 function storyFor(user){const day=shanghaiDay();let saved=db.prepare('SELECT story_order FROM third_story_queues WHERE owner_id=? AND day=?').get(user,day);if(!saved){const order=stories.map(s=>s.id);for(let i=order.length-1;i>0;i--){const j=randomInt(i+1);[order[i],order[j]]=[order[j],order[i]];}db.prepare('INSERT INTO third_story_queues VALUES(?,?,?)').run(user,day,JSON.stringify(order));saved={story_order:JSON.stringify(order)};}return stories.find(s=>s.id===JSON.parse(saved.story_order)[store.dispatchStatus().claimed]);}
 const pending=user=>db.prepare('SELECT * FROM stage_task_offers WHERE owner_id=? AND assignment_id IS NULL AND retired=0').get(user);
 const allowed=(user,id)=>!!db.prepare('SELECT 1 FROM assignments WHERE owner_id=? AND task_id=? UNION ALL SELECT 1 FROM stage_task_offers WHERE owner_id=? AND task_id=? LIMIT 1').get(user,id,user,id);
 const active=user=>db.prepare("SELECT id FROM assignments WHERE owner_id=? AND status IN ('active','review','revision') LIMIT 1").get(user);
 function eligible(user,stage){
  if(![1,2,3].includes(stage))throw new AppError('无效阶段');
  if(stage===1&&db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='newcomer_cover_orders'").get()&&db.prepare('SELECT 1 FROM newcomer_cover_orders WHERE owner_id=?').get(user))throw new AppError('请继续当前版权封面任务',409);
  if(stage===1&&db.prepare("SELECT 1 FROM assignments a JOIN assignment_terms f ON f.assignment_id=a.id WHERE a.owner_id=? AND a.status='completed' AND f.stage=1").get(user))throw new AppError('新手体验任务已完成',409);
  if(stage===2&&!db.prepare("SELECT 1 FROM assignments a JOIN assignment_terms f ON f.assignment_id=a.id WHERE a.owner_id=? AND a.status='completed' AND f.stage=1").get(user))throw new AppError('请先完成第一阶段任务并通过审核',403);
  if(stage===3&&!db.prepare("SELECT 1 FROM stage_enrollments WHERE user_id=? AND status='approved'").get(user))throw new AppError('请先完成第三阶段报名审核',403);
  if(stage===3&&store.dispatchStatus().claimed>=20)throw new AppError('今日第三阶段20单已领取完毕，请明日再来',409);
 }
 function offer(row){if(!row)return null;const task=store.getTask(row.task_id);if(row.stage===3){let story=row.story?JSON.parse(row.story):storyFor(row.owner_id);if(story&&!row.story)db.prepare('UPDATE stage_task_offers SET story=? WHERE id=?').run(JSON.stringify(story),row.id);return {id:row.id,stage:3,reservedAmount:balance.amount(row.owner_id,'stage',row.id),task:{...task,...story, id:task.id,episodes:null,platform:'',language:'',catalogStoryId:story?.id}};}return {id:row.id,stage:row.stage,task};}
 function visible(user,summary){
  const ids=new Set(db.prepare('SELECT task_id FROM assignments WHERE owner_id=? UNION SELECT task_id FROM stage_task_offers WHERE owner_id=? AND assignment_id IS NULL AND retired=0').all(user,user).map(r=>r.task_id));
  const notices=summary.notifications.filter(n=>!n.task_id||ids.has(n.task_id));
  return {...summary,tasks:summary.tasks.filter(t=>ids.has(t.id)),savedTasks:summary.savedTasks?.filter(t=>ids.has(t.id)),bookmarks:summary.bookmarks.filter(id=>ids.has(id)),notifications:notices,notificationsUnread:db.prepare('SELECT COUNT(*) n FROM notifications WHERE owner_id=? AND is_read=0 AND (task_id IS NULL OR task_id IN(SELECT task_id FROM assignments WHERE owner_id=? UNION SELECT task_id FROM stage_task_offers WHERE owner_id=? AND assignment_id IS NULL AND retired=0))').get(user,user,user).n};
 }
 return {
  allowed,visible,
  discard(user,id){if(typeof id!=='string'||!id||id.length>80)throw new AppError('无效的任务标识');return store.asUser(user,()=>store.audited(user,'stage.discard',String(id),()=>{
   const r=db.prepare('SELECT * FROM stage_task_offers WHERE id=? AND owner_id=? AND stage=3').get(id,user);
   if(!r||r.assignment_id)throw new AppError('当前任务无法取消领取',409);
   if(!r.retired){balance.release(user,'stage',r.id);db.prepare('UPDATE stage_task_offers SET retired=1 WHERE id=? AND owner_id=?').run(id,user);}
   return {ok:true};
  }));},
  reserve(user,id){if(id!==undefined&&(typeof id!=='string'||!id||id.length>80))throw new AppError('无效的任务标识');return store.asUser(user,()=>store.audited(user,'stage.reserve',String(id),()=>{
   const r=pending(user);if(!r&&!id)return null;if(!r||(id&&r.id!==id)||r.stage!==3)throw new AppError('请先领取当前作品',409);eligible(user,3);
   const task=store.getTask(r.task_id);if(!task.active)throw new AppError('作品已暂停，请联系平台处理已领取任务',409);
   balance.reserve(user,'stage',r.id,task.deposit,task.title);return offer(r);
  }));},
  pending(user){return store.asUser(user,()=>offer(pending(user)));},
  draw(user,stage){return store.asUser(user,()=>store.audited(user,'stage.draw',String(stage),()=>{
   eligible(user,stage);
   if(active(user))throw new AppError('请先完成并通过审核当前任务，再领取下一项',409);
   const old=pending(user);if(old){if(old.stage!==stage)throw new AppError('请先接受已领取的任务',409);if(stage===3)balance.reserve(user,'stage',old.id,store.getTask(old.task_id).deposit,store.getTask(old.task_id).title);return offer(old);}
   if(store.commissionSettings().rate_bps===null)throw new AppError('平台尚未配置佣金比例',409);
   const tasks=store.summary().tasks.filter(t=>t.stage===stage&&t.remaining>0);
   if(!tasks.length)throw new AppError('本阶段暂无可派发任务，请稍后再来',409);
   const nextStory=stage===3?storyFor(user):null;
   const selected=(nextStory?tasks.find(t=>t.title===nextStory.title):null)||tasks[randomInt(tasks.length)],id=randomUUID();
   db.prepare('INSERT INTO stage_task_offers(id,owner_id,stage,task_id,created_at) VALUES(?,?,?,?,?)').run(id,user,stage,selected.id,new Date().toISOString());
   if(stage===3)balance.reserve(user,'stage',id,selected.deposit,selected.title);
   return offer(pending(user));
  }));},
  accept(user,id,expected){return store.asUser(user,()=>store.audited(user,'stage.accept',String(id),()=>{
   const row=db.prepare('SELECT * FROM stage_task_offers WHERE id=? AND owner_id=?').get(id,user);
   if(!row)throw new AppError('请先领取随机任务',404);
   if(row.retired)throw new AppError('此任务已更新，请返回当前成长计划',409);
   if(row.assignment_id)return store.assignment(row.assignment_id);
   eligible(user,row.stage);
   if(active(user))throw new AppError('请先完成并通过审核当前任务',409);
   if(row.stage===3)balance.convert(user,'stage',row.id);
   const assignment=store.claim(row.task_id,expected);
   db.prepare('UPDATE stage_task_offers SET assignment_id=? WHERE id=? AND owner_id=?').run(assignment.id,id,user);
   return assignment;
  }));},
  acceptTask(user,taskId,expected){
   if(typeof taskId!=="string"||!taskId||taskId.length>80)throw new AppError("无效的任务标识");
   const old=db.prepare("SELECT id FROM assignments WHERE owner_id=? AND task_id=? AND status IN ('active','review','revision')").get(user,taskId);
   if(old)return store.asUser(user,()=>store.assignment(old.id));
   const row=pending(user);if(!row||row.task_id!==taskId)throw new AppError('请先领取系统随机派发的任务',409);
   return this.accept(user,row.id,expected);
  }
 };
}
