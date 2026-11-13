import {recordTaskActivity} from './reputation.mjs';
import {settleReferralRound} from './referrals.mjs';
import {randomBytes} from 'node:crypto';
import {AppError} from './store.mjs';
export function createThirdCopyright(store){
 const db=store.db;
 db.exec(`CREATE TABLE IF NOT EXISTS third_copyright_codes(assignment_id TEXT PRIMARY KEY REFERENCES assignments(id),owner_id TEXT NOT NULL,code TEXT UNIQUE NOT NULL,created_at TEXT NOT NULL);`);
 // Correct only old publishing copy on records that already have a copyright code.
 db.prepare("UPDATE notifications SET body=replace(body,'请在 48 小时内完成发布','复制并提交版权码即可完成任务') WHERE assignment_id IN (SELECT assignment_id FROM third_copyright_codes) AND body LIKE '%请在 48 小时内完成发布%'").run();
 function view(user,id){
  if(typeof id!=='string'||!id||id.length>80)throw new AppError('无效的版权任务');
  const assignment=store.assignment(id);
  if(assignment.owner_id!==user||assignment.task.stage!==3)throw new AppError('版权任务不存在',404);
  if(assignment.status!=='cancelled')db.prepare('INSERT OR IGNORE INTO third_copyright_codes VALUES(?,?,?,?)').run(id,user,'CR-'+randomBytes(12).toString('hex').toUpperCase(),new Date().toISOString());
  const row=db.prepare('SELECT code FROM third_copyright_codes WHERE assignment_id=? AND owner_id=?').get(id,user);
  return {assignment,code:assignment.status==='cancelled'?null:row?.code||null};
 }
 function scoped(user,action,id,fn){return store.asUser(user,()=>store.audited(user,action,String(id),fn));}
 return {
  snapshot(user,id){return scoped(user,'copyright.read',id,()=>view(user,id));},
  complete(user,input){return scoped(user,'copyright.complete',input.assignmentId,()=>{
   const state=view(user,input.assignmentId),a=state.assignment;
   if(typeof input.code!=='string'||!state.code||input.code!==state.code)throw new AppError('请复制并提交当前任务的版权码',409);
   if(a.status==='completed')return {...state,first:false};
   if(!['active','revision','review'].includes(a.status))throw new AppError('当前版权任务无法完成',409);
   const time=new Date().toISOString();
   const post=(kind,amount,key,note)=>{
    const current=db.prepare('SELECT COALESCE(SUM(amount),0) n FROM ledger WHERE owner_id=?').get(user).n;
    db.prepare('INSERT INTO ledger(assignment_id,kind,amount,balance_after,note,operation_key,created_at,owner_id) VALUES(?,?,?,?,?,?,?,?)').run(a.id,kind,amount,current+amount,note,key,time,user);
   };
   db.prepare("UPDATE assignments SET status='completed',submitted_at=?,reviewed_at=?,review_note='' WHERE id=? AND owner_id=?").run(time,time,a.id,user);
   post('release',a.task.deposit,'release:'+a.id,'版权任务完成 · 金额返还');
   post('reward',a.task.commission,'reward:'+a.id,'版权任务佣金 · '+a.task.title);
   db.prepare("INSERT INTO events(assignment_id,type,description,created_at) VALUES(?,'copyright_completed',?,?)").run(a.id,'版权码已核验，任务已完成，版权金额已返还，佣金已到账',time);
   store.notifyUser(user,'版权任务已完成',a.task.title+' · 版权金额已返还，佣金已到账','stage',a.id);
   settleReferralRound(store,user,a.id);
   recordTaskActivity(store,user);
   return {...view(user,a.id),first:true};
  });}
 };
}
