import {generateInviteCode,inviteAliases} from './invite-codes.mjs';
import {AppError} from './store.mjs';
import {DAILY_TASK_LIMIT} from './third-plan.mjs';
export function initializeReferrals(db){
 db.exec(`CREATE TABLE IF NOT EXISTS personal_invites(user_id TEXT PRIMARY KEY REFERENCES creator_accounts(id),code TEXT UNIQUE NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS referral_links(child_id TEXT PRIMARY KEY REFERENCES creator_accounts(id),parent_id TEXT NOT NULL REFERENCES creator_accounts(id),created_at TEXT NOT NULL,CHECK(child_id!=parent_id));
 CREATE INDEX IF NOT EXISTS referral_links_parent ON referral_links(parent_id);
 CREATE TABLE IF NOT EXISTS referral_policy(id INTEGER PRIMARY KEY CHECK(id=1),rate_bps INTEGER NOT NULL CHECK(rate_bps BETWEEN 0 AND 10000),revision INTEGER NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS referral_settlements(child_id TEXT NOT NULL,parent_id TEXT NOT NULL,batch INTEGER NOT NULL,commission_cents INTEGER NOT NULL,rate_bps INTEGER NOT NULL,amount_cents INTEGER NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(child_id,batch));
 INSERT OR IGNORE INTO referral_policy VALUES(1,500,0,strftime('%Y-%m-%dT%H:%M:%fZ','now'));`);
}
export function referralPolicy(db){initializeReferrals(db);const p=db.prepare('SELECT * FROM referral_policy WHERE id=1').get();return {ratePercent:p.rate_bps/100,revision:p.revision};}
export function saveReferralPolicy(store,actor,input){
 initializeReferrals(store.db);
 if(!/^\d+(\.\d{1,2})?$/.test(String(input.ratePercent))||Number(input.ratePercent)>100||Number(input.ratePercent)<0||!Number.isInteger(input.revision))throw new AppError('邀请佣金比例需为0–100%，最多两位小数');
 return store.audited(actor,'referral.policy','global',()=>{const row=store.db.prepare('UPDATE referral_policy SET rate_bps=?,revision=revision+1,updated_at=? WHERE id=1 AND revision=?').run(Math.round(Number(input.ratePercent)*100),new Date().toISOString(),input.revision);if(!row.changes)throw new AppError('设置已更新，请重新读取后再保存',409);return referralPolicy(store.db);},{ratePercent:Number(input.ratePercent)});
}
export function personalInvite(db,user){
 initializeReferrals(db);let row=db.prepare('SELECT code FROM personal_invites WHERE user_id=?').get(user);if(row)return row.code;
 if(!db.prepare('SELECT id FROM creator_accounts WHERE id=?').get(user))throw new AppError('账号不存在',404);
 const code=generateInviteCode(db);
 db.prepare('INSERT INTO personal_invites VALUES(?,?,?)').run(user,code,new Date().toISOString());return code;
}
export function personalInviter(db,code){initializeReferrals(db);inviteAliases(db);return db.prepare("SELECT a.* FROM creator_accounts a WHERE a.id=(SELECT user_id FROM personal_invites WHERE code=? UNION ALL SELECT target_id FROM invite_code_aliases WHERE code=? AND kind='personal' LIMIT 1)").get(code,code);}
export function bindNewReferral(db,child,parent){
 if(child===parent||!db.prepare('SELECT id FROM creator_accounts WHERE id=?').get(parent))throw new AppError('邀请关系无效');
 // Only registration invokes this function; there is no account-side rebinding endpoint.
 db.prepare('INSERT INTO referral_links VALUES(?,?,?)').run(child,parent,new Date().toISOString());
}
export function settleReferralRound(store,child,assignmentId){
 const db=store.db;initializeReferrals(db);const link=db.prepare('SELECT parent_id FROM referral_links WHERE child_id=?').get(child);if(!link)return null;
 const item=db.prepare('SELECT position FROM third_plan_items WHERE owner_id=? AND assignment_id=?').get(child,assignmentId);if(!item)return null;
 const batch=Math.floor(item.position/DAILY_TASK_LIMIT),start=batch*DAILY_TASK_LIMIT;
 if(db.prepare('SELECT 1 FROM referral_settlements WHERE child_id=? AND batch=?').get(child,batch))return null;
 const tasks=db.prepare(`SELECT i.assignment_id,a.status FROM third_plan_items i LEFT JOIN assignments a ON a.id=i.assignment_id WHERE i.owner_id=? AND i.position>=? AND i.position<?`).all(child,start,start+DAILY_TASK_LIMIT);
 if(tasks.length!==DAILY_TASK_LIMIT||tasks.some(a=>a.status!=='completed'))return null;
 const commission=db.prepare(`SELECT COALESCE(SUM(l.amount),0) cents FROM third_plan_items i JOIN ledger l ON l.assignment_id=i.assignment_id AND l.owner_id=i.owner_id AND l.kind='reward' WHERE i.owner_id=? AND i.position>=? AND i.position<?`).get(child,start,start+DAILY_TASK_LIMIT).cents;
 const rate=db.prepare('SELECT rate_bps FROM referral_policy WHERE id=1').get().rate_bps,amount=Math.round(commission*rate/10000),time=new Date().toISOString();
 db.prepare('INSERT INTO referral_settlements VALUES(?,?,?,?,?,?,?)').run(child,link.parent_id,batch,commission,rate,amount,time);
 if(amount>0){const balance=db.prepare('SELECT COALESCE(SUM(amount),0) cents FROM ledger WHERE owner_id=?').get(link.parent_id).cents;db.prepare('INSERT INTO ledger(assignment_id,kind,amount,balance_after,note,operation_key,created_at,owner_id) VALUES(NULL,?,?,?,?,?,?,?)').run('referral_reward',amount,balance+amount,'直属邀请佣金 · 第'+(batch+1)+'轮','referral:'+child+':'+batch,time,link.parent_id);store.notifyUser(link.parent_id,'邀请佣金已到账','直属成员完成一轮任务，邀请佣金已入账。','finance','referral:'+child+':'+batch);}
 return {amount,ratePercent:rate/100,commission,batch:batch+1};
}
export function referralSummary(store,user){
 const db=store.db,code=personalInvite(db,user),policy=referralPolicy(db);
 const children=db.prepare('SELECT r.child_id,p.name,r.created_at FROM referral_links r LEFT JOIN creator_profiles p ON p.user_id=r.child_id WHERE r.parent_id=? ORDER BY r.created_at DESC').all(user);
 const settlements=db.prepare('SELECT s.batch,s.commission_cents,s.rate_bps,s.amount_cents,s.created_at,p.name FROM referral_settlements s LEFT JOIN creator_profiles p ON p.user_id=s.child_id WHERE s.parent_id=? ORDER BY s.created_at DESC LIMIT 100').all(user);
 return {code,ratePercent:policy.ratePercent,invitedCount:children.length,earned:db.prepare('SELECT COALESCE(SUM(amount_cents),0) cents FROM referral_settlements WHERE parent_id=?').get(user).cents,members:children.map(x=>({name:x.name,createdAt:x.created_at})),settlements:settlements.map(x=>({name:x.name,batch:x.batch,commission:x.commission_cents,ratePercent:x.rate_bps/100,amount:x.amount_cents,createdAt:x.created_at}))};
}

