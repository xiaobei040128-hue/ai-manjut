import {createEarlyStagePolicy} from './early-stage-policy.mjs';
import {readFileSync} from 'node:fs';
import {createTaskBalance} from './task-balance.mjs';
const fixedStories=JSON.parse(readFileSync(new URL('./community-stories.json',import.meta.url),'utf8'));
import {randomBytes,randomInt,randomUUID} from 'node:crypto';
import {AppError} from './store.mjs';
export function createCommunityLicenses(store){
 const db=store.db,balance=createTaskBalance(store);
 db.exec(`CREATE TABLE IF NOT EXISTS community_license_orders(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,step INTEGER NOT NULL,artwork TEXT NOT NULL,amount INTEGER NOT NULL,commission INTEGER NOT NULL,rate_bps INTEGER NOT NULL,state TEXT NOT NULL DEFAULT 'offered',code TEXT UNIQUE,created_at TEXT NOT NULL,UNIQUE(owner_id,step));`);
 for(const step of [3,4])db.prepare("UPDATE community_license_orders SET artwork=? WHERE step=? AND state='offered'").run(JSON.stringify(fixedStories[step-3]),step);
 const row=(user,step)=>db.prepare('SELECT * FROM community_license_orders WHERE owner_id=? AND step=?').get(user,step);
 const view=r=>r?{id:r.id,step:r.step,artwork:JSON.parse(r.artwork),amount:r.amount,commission:r.commission,state:r.state,code:r.code,reservedAmount:balance.amount(r.owner_id,'community',r.id)}:null;
 function post(user,kind,amount,key,note){const balance=db.prepare('SELECT COALESCE(SUM(amount),0) n FROM ledger WHERE owner_id=?').get(user).n;if(balance+amount<0)throw new AppError('余额不足，请先充值',409);db.prepare('INSERT INTO ledger(kind,amount,balance_after,note,operation_key,created_at,owner_id) VALUES(?,?,?,?,?,?,?)').run(kind,amount,balance+amount,note,key,new Date().toISOString(),user);}
 return {
  reserve(user,step){const r=row(user,step);if(r?.state==='offered')balance.reserve(user,'community',r.id,r.amount,JSON.parse(r.artwork).title);return view(row(user,step));},
  cancel(user,input){return store.asUser(user,()=>store.audited(user,'community.license.cancel',String(input.orderId),()=>{
   const r=row(user,input.step),p=db.prepare('SELECT * FROM community_progress WHERE owner_id=?').get(user);
   if(!r||r.id!==input.orderId||r.state!=='offered'||p?.completed!==input.step)throw new AppError('当前任务无法取消领取',409);
   balance.release(user,'community',r.id);db.prepare('UPDATE community_progress SET revealed=-1,updated_at=? WHERE owner_id=?').run(new Date().toISOString(),user);
  }));},
  snapshot(user,step){return view(row(user,step));},
  reveal(user,step){const old=row(user,step);if(old)return view(old);if(![3,4].includes(step))throw new AppError('无效任务');const config=createEarlyStagePolicy(store).effective(user)[step===3?'license4':'license5'],amount=config.amount,rate=config.rateBps??randomInt(300,401),commission=Math.round(amount*rate/10000),artwork=fixedStories[step-3];db.prepare('INSERT INTO community_license_orders(id,owner_id,step,artwork,amount,commission,rate_bps,created_at) VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),user,step,JSON.stringify(artwork),amount,commission,rate,new Date().toISOString());return view(row(user,step));},
  purchase(user,input){return store.asUser(user,()=>store.audited(user,'community.license.purchase',String(input.orderId),()=>{const r=row(user,input.step),progress=db.prepare('SELECT completed,revealed FROM community_progress WHERE owner_id=?').get(user);if(!r||r.id!==input.orderId||progress?.completed!==input.step||progress.revealed!==input.step)throw new AppError('请先领取当前版权任务',409);if(r.state!=='offered')return view(r);if(input.amount!==r.amount||input.commission!==r.commission)throw new AppError('请刷新购买信息后确认',409);balance.convert(user,'community',r.id);post(user,'hold',-r.amount,'community-hold:'+r.id,'购买单集版权 · '+JSON.parse(r.artwork).title);db.prepare("UPDATE community_license_orders SET state='purchased',code=? WHERE id=?").run('EP-'+randomBytes(9).toString('hex').toUpperCase(),r.id);return view(row(user,input.step));}));},
  complete(user,step,code){const r=row(user,step);if(!r||r.state!=='purchased'||code!==r.code)throw new AppError('请购买并提交当前版权码',409);post(user,'release',r.amount,'community-release:'+r.id,'单集版权任务完成 · 本金返还');post(user,'reward',r.commission,'community-reward:'+r.id,'单集版权任务佣金');db.prepare("UPDATE community_license_orders SET state='completed' WHERE id=?").run(r.id);return r.commission;}
 };
}
