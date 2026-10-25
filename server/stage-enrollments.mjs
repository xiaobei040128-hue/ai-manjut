
import {randomUUID} from 'node:crypto';
import {AppError} from './store.mjs';
export function createStageEnrollments(store,scope){
 const db=store.db,now=()=>new Date().toISOString();
 db.exec(`CREATE TABLE IF NOT EXISTS stage_enrollments(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES creator_accounts(id),stage INTEGER NOT NULL DEFAULT 3,status TEXT NOT NULL DEFAULT 'pending',note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,reviewed_at TEXT,reviewed_by TEXT);
 CREATE INDEX IF NOT EXISTS stage_enrollments_owner ON stage_enrollments(user_id,created_at);`);
 const latest=id=>db.prepare('SELECT * FROM stage_enrollments WHERE user_id=? ORDER BY rowid DESC LIMIT 1').get(id)||null;
 function active(id){const u=db.prepare('SELECT frozen FROM creator_accounts WHERE id=?').get(id);if(!u)throw new AppError('账号不存在',404);if(u.frozen)throw new AppError('账号已冻结',403);}
 function eligible(id){
  if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='community_progress'").get()){
   const progress=db.prepare('SELECT completed FROM community_progress WHERE owner_id=?').get(id);if(progress)return progress.completed===5;
  }
  return !!db.prepare("SELECT a.id FROM assignments a JOIN assignment_terms f ON f.assignment_id=a.id WHERE a.owner_id=? AND a.status='completed' AND f.stage=2").get(id);}
 function status(id){active(id);const r=latest(id);return {eligible:eligible(id),enrollment:r?{id:r.id,status:r.status,note:r.note,created_at:r.created_at,reviewed_at:r.reviewed_at}:null};}
 function access(id){const state=status(id);if(state.enrollment?.status!=='approved')throw new AppError('第三阶段需报名并经后台审核通过',403);return {stage:3,unlocked:true,enrollmentId:state.enrollment.id};}
 return {
  status,access,
  apply(id){active(id);return store.audited('creator','stage.apply',id,()=>{if(!eligible(id))throw new AppError('请先完成第二阶段',409);const old=latest(id);if(old&&['pending','approved'].includes(old.status))return status(id);db.prepare('INSERT INTO stage_enrollments(id,user_id,created_at) VALUES(?,?,?)').run(randomUUID(),id,now());return status(id);},{stage:3});},

  list(op){const allowed=scope.users(op),owners=allowed?JSON.stringify([...allowed]):null;return db.prepare('SELECT e.*,a.email,p.name FROM stage_enrollments e JOIN creator_accounts a ON a.id=e.user_id JOIN creator_profiles p ON p.user_id=e.user_id WHERE (? IS NULL OR e.user_id IN(SELECT value FROM json_each(?))) ORDER BY e.created_at DESC,e.rowid DESC').all(owners,owners);},
  review(op,id,input){const row=db.prepare('SELECT * FROM stage_enrollments WHERE id=?').get(id);if(!row)throw new AppError('报名不存在',404);scope.assertUser(op,row.user_id);const note=typeof input.note==='string'?input.note.trim().slice(0,500):'';if(!['approve','reject'].includes(input.decision)||input.decision==='reject'&&note.length<3)throw new AppError('请选择审核结果；拒绝时需填写至少 3 字原因');return store.audited(op.username,'stage.'+input.decision,id,()=>{if(latest(row.user_id)?.id!==id||db.prepare('SELECT status FROM stage_enrollments WHERE id=?').get(id).status!=='pending')throw new AppError('此报名已处理，请刷新',409);if(input.decision==='approve'){active(row.user_id);if(!eligible(row.user_id))throw new AppError('客户第二阶段尚未完成',409);}const time=now();db.prepare('UPDATE stage_enrollments SET status=?,note=?,reviewed_at=?,reviewed_by=? WHERE id=?').run(input.decision==='approve'?'approved':'rejected',note,time,op.username,id);store.notifyUser(row.user_id,'第三阶段报名结果',input.decision==='approve'?'报名审核通过，可进入第三阶段。':'报名未通过：'+note,'stage',id);return {ok:true,enrollment:db.prepare('SELECT e.*,a.email,p.name FROM stage_enrollments e JOIN creator_accounts a ON a.id=e.user_id JOIN creator_profiles p ON p.user_id=e.user_id WHERE e.id=?').get(id)};},{stage:3,decision:input.decision,note});}
 };
}
