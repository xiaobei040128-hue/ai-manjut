import {randomInt,randomUUID} from 'node:crypto';
import {AppError} from './store.mjs';

// A draw is persistent and personal. It reserves the reveal, never the money.
export function createStageDispatch(store){
 const db=store.db;
 db.exec(`CREATE TABLE IF NOT EXISTS stage_task_offers(
  id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,stage INTEGER NOT NULL,task_id TEXT NOT NULL,
  assignment_id TEXT,created_at TEXT NOT NULL);
  CREATE UNIQUE INDEX IF NOT EXISTS stage_offer_pending ON stage_task_offers(owner_id) WHERE assignment_id IS NULL;`);
 const pending=user=>db.prepare('SELECT * FROM stage_task_offers WHERE owner_id=? AND assignment_id IS NULL').get(user);
 const allowed=(user,id)=>!!db.prepare('SELECT 1 FROM assignments WHERE owner_id=? AND task_id=? UNION ALL SELECT 1 FROM stage_task_offers WHERE owner_id=? AND task_id=? LIMIT 1').get(user,id,user,id);
 const active=user=>db.prepare("SELECT id FROM assignments WHERE owner_id=? AND status IN ('active','review','revision') LIMIT 1").get(user);
 function eligible(user,stage){
  if(![1,2,3].includes(stage))throw new AppError('无效阶段');
  if(stage===1&&db.prepare("SELECT 1 FROM assignments a JOIN assignment_terms f ON f.assignment_id=a.id WHERE a.owner_id=? AND a.status='completed' AND f.stage=1").get(user))throw new AppError('新手体验任务已完成',409);
  if(stage===2&&!db.prepare("SELECT 1 FROM assignments a JOIN assignment_terms f ON f.assignment_id=a.id WHERE a.owner_id=? AND a.status='completed' AND f.stage=1").get(user))throw new AppError('请先完成第一阶段任务并通过审核',403);
  if(stage===3&&!db.prepare("SELECT 1 FROM stage_enrollments WHERE user_id=? AND status='approved'").get(user))throw new AppError('请先完成第三阶段报名审核',403);
  if(stage===3&&store.dispatchStatus().claimed>=20)throw new AppError('今日第三阶段20单已领取完毕，请明日再来',409);
 }
 function offer(row){return row?{id:row.id,stage:row.stage,task:store.getTask(row.task_id)}:null;}
 function visible(user,summary){
  const ids=new Set(db.prepare('SELECT task_id FROM assignments WHERE owner_id=? UNION SELECT task_id FROM stage_task_offers WHERE owner_id=? AND assignment_id IS NULL').all(user,user).map(r=>r.task_id));
  const notices=summary.notifications.filter(n=>!n.task_id||ids.has(n.task_id));
  return {...summary,tasks:summary.tasks.filter(t=>ids.has(t.id)),savedTasks:summary.savedTasks?.filter(t=>ids.has(t.id)),bookmarks:summary.bookmarks.filter(id=>ids.has(id)),notifications:notices,notificationsUnread:db.prepare('SELECT COUNT(*) n FROM notifications WHERE owner_id=? AND is_read=0 AND (task_id IS NULL OR task_id IN(SELECT task_id FROM assignments WHERE owner_id=? UNION SELECT task_id FROM stage_task_offers WHERE owner_id=? AND assignment_id IS NULL))').get(user,user,user).n};
 }
 return {
  allowed,visible,
  pending(user){return store.asUser(user,()=>offer(pending(user)));},
  draw(user,stage){return store.asUser(user,()=>store.audited(user,'stage.draw',String(stage),()=>{
   eligible(user,stage);
   if(active(user))throw new AppError('请先完成并通过审核当前任务，再领取下一项',409);
   const old=pending(user);if(old){if(old.stage!==stage)throw new AppError('请先接受已领取的任务',409);return offer(old);}
   if(store.commissionSettings().rate_bps===null)throw new AppError('平台尚未配置佣金比例',409);
   const tasks=store.summary().tasks.filter(t=>t.stage===stage&&t.remaining>0);
   if(!tasks.length)throw new AppError('本阶段暂无可派发任务，请稍后再来',409);
   const selected=tasks[randomInt(tasks.length)],id=randomUUID();
   db.prepare('INSERT INTO stage_task_offers(id,owner_id,stage,task_id,created_at) VALUES(?,?,?,?,?)').run(id,user,stage,selected.id,new Date().toISOString());
   return offer(pending(user));
  }));},
  accept(user,id,expected){return store.asUser(user,()=>store.audited(user,'stage.accept',String(id),()=>{
   const row=db.prepare('SELECT * FROM stage_task_offers WHERE id=? AND owner_id=?').get(id,user);
   if(!row)throw new AppError('请先领取随机任务',404);
   if(row.assignment_id)return store.assignment(row.assignment_id);
   eligible(user,row.stage);
   if(active(user))throw new AppError('请先完成并通过审核当前任务',409);
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
