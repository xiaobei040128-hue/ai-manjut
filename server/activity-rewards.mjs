import {randomUUID} from 'node:crypto';
import {AppError} from './store.mjs';
const now=()=>new Date().toISOString();
const text=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
function amount(v){if(!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(String(v)))throw new AppError('请输入最多两位小数的金额');const n=Math.round(Number(v)*100);if(n<1||n>10000000)throw new AppError('金额须在 0.01–100,000 USD 之间');return n;}
export function createActivityRewards(store,scope){
 const db=store.db;
 db.exec(`CREATE TABLE IF NOT EXISTS reward_campaigns(id TEXT PRIMARY KEY,name TEXT NOT NULL,amount INTEGER NOT NULL,budget INTEGER NOT NULL,operator_id TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS activity_grants(id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES reward_campaigns(id),user_id TEXT NOT NULL REFERENCES creator_accounts(id),amount INTEGER NOT NULL,actor_id TEXT NOT NULL,actor_name TEXT NOT NULL,reason TEXT NOT NULL,operation_key TEXT UNIQUE NOT NULL,created_at TEXT NOT NULL,UNIQUE(campaign_id,user_id));
 CREATE INDEX IF NOT EXISTS activity_grants_owner ON activity_grants(user_id,created_at);`);
 const campaigns=()=>db.prepare('SELECT c.*,(SELECT COALESCE(SUM(amount),0) FROM activity_grants g WHERE g.campaign_id=c.id) AS spent FROM reward_campaigns c ORDER BY c.created_at DESC').all();
 function campaign(op,id){const c=db.prepare('SELECT * FROM reward_campaigns WHERE id=?').get(id);if(!c)throw new AppError('活动不存在',404);if(op.role!=='super'&&c.operator_id!==op.id)throw new AppError('未获授权发放此活动奖励',403);return c;}
 const receipt=id=>db.prepare('SELECT g.*,c.name AS campaign_name,a.email FROM activity_grants g JOIN reward_campaigns c ON c.id=g.campaign_id JOIN creator_accounts a ON a.id=g.user_id WHERE g.id=?').get(id);
 return {
  snapshot(op){const allowed=scope.users(op);return {campaigns:campaigns().filter(c=>op.role==='super'||c.operator_id===op.id),grants:db.prepare('SELECT id FROM activity_grants ORDER BY created_at DESC').all().map(g=>receipt(g.id)).filter(g=>!allowed||allowed.has(g.user_id))};},
  create(op,input){if(op.role!=='super')throw new AppError('仅总后台可配置活动',403);const name=text(input.name,80),reward=amount(input.amount),budget=amount(input.budget),operatorId=text(input.operatorId,80);if(name.length<2||budget<reward)throw new AppError('请填写活动名称，预算不得低于单人奖励');if(operatorId!=='super'&&!db.prepare('SELECT id FROM agent_admins WHERE id=? AND active=1').get(operatorId))throw new AppError('请选择有效发放员');const id=randomUUID();return store.audited(op.username,'activity.create',id,()=>{db.prepare('INSERT INTO reward_campaigns(id,name,amount,budget,operator_id,created_by,created_at) VALUES(?,?,?,?,?,?,?)').run(id,name,reward,budget,operatorId,op.username,now());return campaign(op,id);},{name,amount:reward,budget,operatorId});},
  state(op,id,input){if(op.role!=='super')throw new AppError('仅总后台可启停活动',403);if(typeof input.active!=='boolean')throw new AppError('无效活动状态');campaign(op,id);return store.audited(op.username,'activity.state',id,()=>{db.prepare('UPDATE reward_campaigns SET active=? WHERE id=?').run(Number(input.active),id);return {ok:true};},{active:input.active});},
  grant(op,id,input){
   const userId=text(input.userId,80),reason=text(input.reason,500),key=text(input.operationKey,80);
   scope.assertUser(op,userId);campaign(op,id);
   if(reason.length<3||!/^[-a-zA-Z0-9]{16,80}$/.test(key)||input.confirm!==true)throw new AppError('请填写发放原因并确认入账');
   return store.audited(op.username,'activity.grant',userId,()=>{
    const old=db.prepare('SELECT * FROM activity_grants WHERE operation_key=?').get(key);
    if(old){if(old.user_id!==userId||old.campaign_id!==id||old.actor_id!==op.id||old.reason!==reason)throw new AppError('请求标识已被其他发放使用',409);return receipt(old.id);}
    const c=campaign(op,id),user=db.prepare('SELECT frozen FROM creator_accounts WHERE id=?').get(userId);
    if(!user)throw new AppError('客户不存在',404);if(user.frozen)throw new AppError('冻结账号不能接收奖励',403);
    if(!c.active)throw new AppError('活动已暂停',409);
    if(db.prepare('SELECT id FROM activity_grants WHERE campaign_id=? AND user_id=?').get(id,userId))throw new AppError('此客户已领取该活动奖励',409);
    const spent=db.prepare('SELECT COALESCE(SUM(amount),0) AS n FROM activity_grants WHERE campaign_id=?').get(id).n;
    if(spent+c.amount>c.budget)throw new AppError('活动预算不足',409);
    const grantId=randomUUID(),time=now(),balance=db.prepare('SELECT COALESCE(SUM(amount),0) AS n FROM ledger WHERE owner_id=?').get(userId).n;
    db.prepare('INSERT INTO activity_grants(id,campaign_id,user_id,amount,actor_id,actor_name,reason,operation_key,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(grantId,id,userId,c.amount,op.id,op.username,reason,key,time);
    db.prepare('INSERT INTO ledger(kind,amount,balance_after,note,operation_key,created_at,owner_id) VALUES(?,?,?,?,?,?,?)').run('activity_reward',c.amount,balance+c.amount,'活动奖励 · '+c.name+' · '+reason,'activity:'+grantId,time,userId);
    db.prepare('INSERT INTO notifications(id,title,body,is_read,created_at,owner_id) VALUES(?,?,?,0,?,?)').run(randomUUID(),'活动奖励已到账',c.name+'：'+(c.amount/100).toFixed(2)+' USD。可在钱包查看流水。',time,userId);
    return receipt(grantId);
   },{campaignId:id,reason,operationKey:key});
  }
 };
}
