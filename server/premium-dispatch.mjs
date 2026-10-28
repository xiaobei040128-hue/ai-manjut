import {customerJourneyProgress} from './customer-journey-progress.mjs';
import {AppError} from './store.mjs';
import {shanghaiDay} from './time.mjs';
export const dispatchDay=shanghaiDay;
export function createPremiumDispatch(store,scope){
 const db=store.db;
 const state=(id,day)=>db.prepare('SELECT * FROM premium_dispatch_policy WHERE user_id=? AND day=?').get(id,day);
 const frontier=(id,day)=>db.prepare('SELECT COALESCE(MAX(f.sequence),0) n FROM assignment_terms f JOIN assignments a ON a.id=f.assignment_id WHERE a.owner_id=? AND f.dispatch_day=?').get(id,day).n;
 const terms=(id,day)=>Object.fromEntries(db.prepare('SELECT sequence,amount,rate_bps FROM premium_dispatch_terms WHERE user_id=? AND day=?').all(id,day).map(r=>[r.sequence,{amount:r.amount,rateBps:r.rate_bps}]));
 const locked=(id,day)=>{let n=frontier(id,day);if(db.prepare("SELECT 1 FROM sqlite_master WHERE name='stage_task_offers'").get()&&db.prepare('PRAGMA table_info(stage_task_offers)').all().some(c=>c.name==='pricing')){const row=db.prepare('SELECT pricing FROM stage_task_offers WHERE owner_id=? AND stage=3 AND retired=0 AND assignment_id IS NULL').get(id);const q=row?.pricing?JSON.parse(row.pricing):null;if(q?.dispatch_day===day)n=Math.max(n,q.dispatch_sequence||0);}return n;};
 return {
  list(op){
   const allowed=scope.users(op),day=dispatchDay(),owners=allowed?JSON.stringify([...allowed]):null;
   const rows=db.prepare(`SELECT a.id,a.email,p.name,COALESCE(d.sequences,'[]') sequences,COALESCE(d.revision,0) revision,d.updated_by,d.updated_at,COALESCE(c.claimedThrough,0) claimedThrough
    FROM creator_accounts a JOIN creator_profiles p ON p.user_id=a.id
    LEFT JOIN premium_dispatch_policy d ON d.user_id=a.id AND d.day=?
    LEFT JOIN (SELECT x.owner_id,MAX(f.sequence) claimedThrough FROM assignment_terms f JOIN assignments x ON x.id=f.assignment_id WHERE f.dispatch_day=? AND (? IS NULL OR x.owner_id IN(SELECT value FROM json_each(?))) GROUP BY x.owner_id) c ON c.owner_id=a.id
    WHERE (? IS NULL OR a.id IN(SELECT value FROM json_each(?))) ORDER BY a.created_at DESC,a.id DESC`).all(day,day,owners,owners,owners,owners);
   return {day,customers:rows.map(row=>({...row,sequences:JSON.parse(row.sequences),terms:terms(row.id,day),lockedThrough:locked(row.id,day),progress:customerJourneyProgress(db,row.id)}))};
  },
  save(op,id,input){scope.assertUser(op,id);if(!db.prepare('SELECT id FROM creator_accounts WHERE id=?').get(id))throw new AppError('客户不存在',404);const day=dispatchDay();if(input.day!==day)throw new AppError('日期已变化，请刷新后设置',409);
   if(!Array.isArray(input.sequences)||input.sequences.length>20||input.sequences.some(n=>!Number.isInteger(n)||n<1||n>20)||new Set(input.sequences).size!==input.sequences.length)throw new AppError('请选择不重复的第 1–10 单，可多选或全部关闭');
   if(!Number.isSafeInteger(input.revision)||input.revision<0)throw new AppError('请刷新后提交配置');
   const sequences=[...input.sequences].sort((a,b)=>a-b);
   return store.audited(op.username,'premium.dispatch.configure',id,()=>{const old=state(id,day),revision=old?.revision||0;if(input.revision!==revision)throw new AppError('配置已被其他页面更新，请刷新',409);const through=locked(id,day),previous=old?JSON.parse(old.sequences):[];
    if(sequences.some(n=>n>10&&!(n<=through&&previous.includes(n))))throw new AppError('每天只能设置第 1–10 单');
    const previousTerms=terms(id,day),nextTerms=input.terms===undefined?{...previousTerms}:Object.fromEntries(Object.entries(previousTerms).filter(([n])=>Number(n)<=through));
    if(input.terms!==undefined){if(!input.terms||typeof input.terms!=='object'||Array.isArray(input.terms))throw new AppError('无效的高阶金额设置');for(const[key,value]of Object.entries(input.terms)){const n=Number(key);if(!sequences.includes(n)||!value||typeof value!=='object')throw new AppError('金额设置必须对应选中的触发序号');const parse=(v,max)=>{if(!/^\d+(\.\d{1,2})?$/.test(String(v)))throw new AppError('金额及佣金率最多保留两位小数');const result=Math.round(Number(v)*100);if(!Number.isSafeInteger(result)||result<1||result>max)throw new AppError('金额需大于0且不超过100万美元，佣金率需大于0且不超过100%');return result;};const valueTerms={amount:parse(value.amount,100000000),rateBps:parse(value.rate,10000)};if(n<=through&&JSON.stringify(previousTerms[n])!==JSON.stringify(valueTerms))throw new AppError('已揭晓或购买的金额和佣金率不能修改',409);nextTerms[n]=valueTerms;}}
    for(let n=1;n<=through;n++)if(previous.includes(n)!==sequences.includes(n))throw new AppError('已领取序号不能追溯修改',409);
    db.prepare('DELETE FROM premium_dispatch_terms WHERE user_id=? AND day=?').run(id,day);for(const[n,t]of Object.entries(nextTerms))if(sequences.includes(Number(n)))db.prepare('INSERT INTO premium_dispatch_terms VALUES(?,?,?,?,?)').run(id,day,Number(n),t.amount,t.rateBps);
    const updatedAt=new Date().toISOString();
    db.prepare('INSERT INTO premium_dispatch_policy(user_id,day,sequences,revision,updated_by,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET sequences=excluded.sequences,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=excluded.updated_at').run(id,day,JSON.stringify(sequences),revision+1,op.username,updatedAt);return {ok:true,day,sequences,revision:revision+1,claimedThrough:frontier(id,day),lockedThrough:through,terms:terms(id,day),updated_by:op.username,updated_at:updatedAt};
   },{day,sequences,terms:input.terms});
  }
 };
}
