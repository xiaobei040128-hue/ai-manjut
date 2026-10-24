import {createDailyExample} from "./daily-example.mjs";
import {randomUUID} from 'node:crypto';
import {AppError} from './store.mjs';
export function createStageEnrollments(store,scope,journeys){
 const db=store.db,now=()=>new Date().toISOString();
 db.exec(`CREATE TABLE IF NOT EXISTS stage_enrollments(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES creator_accounts(id),stage INTEGER NOT NULL DEFAULT 3,status TEXT NOT NULL DEFAULT 'pending',note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,reviewed_at TEXT,reviewed_by TEXT);
 CREATE TABLE IF NOT EXISTS stage_daily_examples(user_id TEXT NOT NULL REFERENCES creator_accounts(id),day TEXT NOT NULL,balance INTEGER NOT NULL,source TEXT NOT NULL,items TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,day));
 CREATE INDEX IF NOT EXISTS stage_enrollments_owner ON stage_enrollments(user_id,created_at);`);
 const latest=id=>db.prepare('SELECT * FROM stage_enrollments WHERE user_id=? ORDER BY rowid DESC LIMIT 1').get(id)||null;
 function active(id){const u=db.prepare('SELECT frozen FROM creator_accounts WHERE id=?').get(id);if(!u)throw new AppError('账号不存在',404);if(u.frozen)throw new AppError('账号已冻结',403);}
 function eligible(id){const j=journeys.get(id);return j.newcomer.stage===6&&j.advanced.community?.completed===5;}
 function status(id){active(id);const r=latest(id);return {eligible:eligible(id),enrollment:r?{id:r.id,status:r.status,note:r.note,created_at:r.created_at,reviewed_at:r.reviewed_at}:null};}
 function access(id){const state=status(id);if(state.enrollment?.status!=='approved')throw new AppError('第三阶段需报名并经后台审核通过',403);return {stage:3,unlocked:true,enrollmentId:state.enrollment.id};}
 const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const wallet=id=>db.prepare('SELECT COALESCE(SUM(amount),0) AS n FROM ledger WHERE owner_id=?').get(id).n;
 function example(id){access(id);const today=day(),row=db.prepare('SELECT * FROM stage_daily_examples WHERE user_id=? AND day=?').get(id,today);return {day:today,walletAvailable:wallet(id),example:row?{...row,items:JSON.parse(row.items)}:null};}
 return {
  status,access,example,
  generate(id,input){access(id);return store.audited('creator','stage.example',id,()=>{
   const current=example(id);if(current.example)return current;
   let balance=wallet(id),source='wallet_snapshot';
   if(input.source==='demo'){
    if(!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(String(input.balance)))throw new AppError('演示余额须为最多两位小数的非负金额');
    balance=Math.round(Number(input.balance)*100);source='demo';
   }else if(input.source!=='wallet')throw new AppError('请选择余额来源');
   if(balance<0||balance>100000000)throw new AppError('余额超出演示计算范围');
   const items=createDailyExample(balance);db.prepare('INSERT INTO stage_daily_examples(user_id,day,balance,source,items,created_at) VALUES(?,?,?,?,?,?)').run(id,current.day,balance,source,JSON.stringify(items),now());return example(id);
  },{source:input.source});},
  apply(id){active(id);return store.audited('creator','stage.apply',id,()=>{if(!eligible(id))throw new AppError('请先完成第二阶段',409);const old=latest(id);if(old&&['pending','approved'].includes(old.status))return status(id);db.prepare('INSERT INTO stage_enrollments(id,user_id,created_at) VALUES(?,?,?)').run(randomUUID(),id,now());return status(id);},{stage:3});},

  list(op){const allowed=scope.users(op);return db.prepare('SELECT e.*,a.email,p.name FROM stage_enrollments e JOIN creator_accounts a ON a.id=e.user_id JOIN creator_profiles p ON p.user_id=e.user_id ORDER BY e.created_at DESC,e.rowid DESC').all().filter(r=>!allowed||allowed.has(r.user_id));},
  review(op,id,input){const row=db.prepare('SELECT * FROM stage_enrollments WHERE id=?').get(id);if(!row)throw new AppError('报名不存在',404);scope.assertUser(op,row.user_id);const note=typeof input.note==='string'?input.note.trim().slice(0,500):'';if(!['approve','reject'].includes(input.decision)||input.decision==='reject'&&note.length<3)throw new AppError('请选择审核结果；拒绝时需填写至少 3 字原因');return store.audited(op.username,'stage.'+input.decision,id,()=>{if(latest(row.user_id)?.id!==id||db.prepare('SELECT status FROM stage_enrollments WHERE id=?').get(id).status!=='pending')throw new AppError('此报名已处理，请刷新',409);if(input.decision==='approve'){active(row.user_id);if(!eligible(row.user_id))throw new AppError('客户第二阶段尚未完成',409);}const time=now();db.prepare('UPDATE stage_enrollments SET status=?,note=?,reviewed_at=?,reviewed_by=? WHERE id=?').run(input.decision==='approve'?'approved':'rejected',note,time,op.username,id);db.prepare('INSERT INTO notifications(id,title,body,is_read,created_at,owner_id) VALUES(?,?,?,0,?,?)').run(randomUUID(),'第三阶段报名结果',input.decision==='approve'?'报名审核通过，可进入第三阶段。':'报名未通过：'+note,time,row.user_id);return {ok:true};},{stage:3,decision:input.decision,note});}
 };
}
