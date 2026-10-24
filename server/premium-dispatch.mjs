import {AppError} from './store.mjs';
import {shanghaiDay} from './time.mjs';
export const dispatchDay=shanghaiDay;
export function createPremiumDispatch(store,scope){
 const db=store.db;
 const state=(id,day)=>db.prepare('SELECT * FROM premium_dispatch_policy WHERE user_id=? AND day=?').get(id,day);
 const frontier=(id,day)=>db.prepare('SELECT COALESCE(MAX(f.sequence),0) n FROM assignment_terms f JOIN assignments a ON a.id=f.assignment_id WHERE a.owner_id=? AND f.dispatch_day=?').get(id,day).n;
 return {
  list(op){
   const allowed=scope.users(op),day=dispatchDay(),owners=allowed?JSON.stringify([...allowed]):null;
   const rows=db.prepare(`SELECT a.id,a.email,p.name,COALESCE(d.sequences,'[]') sequences,COALESCE(d.revision,0) revision,d.updated_by,d.updated_at,COALESCE(c.claimedThrough,0) claimedThrough
    FROM creator_accounts a JOIN creator_profiles p ON p.user_id=a.id
    LEFT JOIN premium_dispatch_policy d ON d.user_id=a.id AND d.day=?
    LEFT JOIN (SELECT x.owner_id,MAX(f.sequence) claimedThrough FROM assignment_terms f JOIN assignments x ON x.id=f.assignment_id WHERE f.dispatch_day=? AND (? IS NULL OR x.owner_id IN(SELECT value FROM json_each(?))) GROUP BY x.owner_id) c ON c.owner_id=a.id
    WHERE (? IS NULL OR a.id IN(SELECT value FROM json_each(?))) ORDER BY a.created_at DESC,a.id DESC`).all(day,day,owners,owners,owners,owners);
   return {day,customers:rows.map(row=>({...row,sequences:JSON.parse(row.sequences)}))};
  },
  save(op,id,input){scope.assertUser(op,id);if(!db.prepare('SELECT id FROM creator_accounts WHERE id=?').get(id))throw new AppError('客户不存在',404);const day=dispatchDay();if(input.day!==day)throw new AppError('日期已变化，请刷新后设置',409);
   if(!Array.isArray(input.sequences)||input.sequences.length>20||input.sequences.some(n=>!Number.isInteger(n)||n<1||n>20)||new Set(input.sequences).size!==input.sequences.length)throw new AppError('请选择不重复的第 1–20 单，可多选或全部关闭');
   if(!Number.isSafeInteger(input.revision)||input.revision<0)throw new AppError('请刷新后提交配置');
   const sequences=[...input.sequences].sort((a,b)=>a-b);
   return store.audited(op.username,'premium.dispatch.configure',id,()=>{const old=state(id,day),revision=old?.revision||0;if(input.revision!==revision)throw new AppError('配置已被其他页面更新，请刷新',409);const through=frontier(id,day),previous=old?JSON.parse(old.sequences):[];
    for(let n=1;n<=through;n++)if(previous.includes(n)!==sequences.includes(n))throw new AppError('已领取序号不能追溯修改',409);
    const updatedAt=new Date().toISOString();
    db.prepare('INSERT INTO premium_dispatch_policy(user_id,day,sequences,revision,updated_by,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET sequences=excluded.sequences,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=excluded.updated_at').run(id,day,JSON.stringify(sequences),revision+1,op.username,updatedAt);return {ok:true,day,sequences,revision:revision+1,claimedThrough:through,updated_by:op.username,updated_at:updatedAt};
   },{day,sequences});
  }
 };
}
