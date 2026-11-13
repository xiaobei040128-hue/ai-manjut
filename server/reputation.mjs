import {randomUUID} from 'node:crypto';
import {AppError} from './store.mjs';
const initialized=new WeakSet();
export function initializeReputation(db){if(initialized.has(db))return;
 db.exec(`CREATE TABLE IF NOT EXISTS reputation_activity(owner_id TEXT NOT NULL,task_day TEXT NOT NULL,batch INTEGER NOT NULL,time_zone TEXT NOT NULL,deadline TEXT NOT NULL,started_at TEXT NOT NULL,processed_at TEXT,PRIMARY KEY(owner_id,task_day));
 CREATE INDEX IF NOT EXISTS reputation_due ON reputation_activity(deadline) WHERE processed_at IS NULL;
 CREATE TABLE IF NOT EXISTS reputation_events(owner_id TEXT NOT NULL,task_day TEXT NOT NULL,batch INTEGER NOT NULL,deadline TEXT NOT NULL,completed INTEGER NOT NULL,score_before INTEGER NOT NULL,score_after INTEGER NOT NULL,deduction INTEGER NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(owner_id,task_day));
 CREATE TABLE IF NOT EXISTS reputation_adjustments(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES creator_accounts(id),score_before INTEGER NOT NULL,score_after INTEGER NOT NULL,reason TEXT NOT NULL,actor TEXT NOT NULL,operation_key TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(owner_id,operation_key));
 CREATE INDEX IF NOT EXISTS reputation_adjustment_owner ON reputation_adjustments(owner_id,created_at);`);initialized.add(db);
}
// Retained exports for older callers. Incomplete tasks never change reputation.
export function recordTaskActivity(){}
export function settleReputation(){return 0;}
export function adjustReputation(store,operator,user,input,scope){
 const db=store.db;initializeReputation(db);scope.assertUser(operator,user);
 const score=input.score,expected=input.expectedScore,reason=input.reason===undefined?'后台调整':typeof input.reason==='string'?input.reason.trim():null,key=input.operationKey;
 if(!Number.isInteger(score)||score<0||score>100||!Number.isInteger(expected)||expected<0||expected>100)throw new AppError('信誉分需为0–100之间的整数');
 if(reason===null||reason.length>200)throw new AppError('备注最多200个字符');
 if(typeof key!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(key))throw new AppError('请求标识无效，请重新操作');
 const note=reason||'后台调整';
 return store.audited(operator.username,'customer.reputation',user,()=>{
  const old=db.prepare('SELECT * FROM reputation_adjustments WHERE owner_id=? AND operation_key=?').get(user,key);
  if(old){if(old.score_after!==score||old.score_before!==expected||old.reason!==note)throw new AppError('请求标识已被其他调整使用',409);return {score:old.score_after,id:old.id};}
  const account=db.prepare('SELECT reputation_score FROM creator_accounts WHERE id=?').get(user);if(!account)throw new AppError('客户不存在',404);
  if(account.reputation_score!==expected)throw new AppError('信誉分已更新，请刷新后再调整',409);
  const id=randomUUID(),now=new Date().toISOString();
  const changed=db.prepare('UPDATE creator_accounts SET reputation_score=? WHERE id=? AND reputation_score=?').run(score,user,expected);if(!changed.changes)throw new AppError('信誉分已更新，请刷新后再调整',409);
  db.prepare('INSERT INTO reputation_adjustments VALUES(?,?,?,?,?,?,?,?)').run(id,user,expected,score,note,operator.username,key,now);
  return {score,id};
 },{scoreBefore:expected,scoreAfter:score,reason:note});
}
export function reputationHistory(db,user){initializeReputation(db);return db.prepare(`
 SELECT 'legacy:'||task_day AS id,'legacy' AS kind,task_day AS taskDay,batch+1 AS batch,deadline,completed,score_before AS scoreBefore,score_after AS scoreAfter,deduction,created_at AS createdAt,'system' AS actor,'历史任务扣分' AS reason FROM reputation_events WHERE owner_id=?
 UNION ALL
 SELECT 'manual:'||id AS id,'manual' AS kind,substr(created_at,1,10) AS taskDay,NULL AS batch,NULL AS deadline,NULL AS completed,score_before AS scoreBefore,score_after AS scoreAfter,score_before-score_after AS deduction,created_at AS createdAt,actor,reason FROM reputation_adjustments WHERE owner_id=?
 ORDER BY createdAt DESC,id DESC LIMIT 50`).all(user,user);}
