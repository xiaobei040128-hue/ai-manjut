import {AppError} from './store.mjs';
const limit=25;
function cursor(value,kind){
 if(value===undefined||value===null||value==='')return null;
 try{
  if(typeof value!=='string'||value.length>400||!/^[A-Za-z0-9_-]+$/.test(value))throw 0;
  const row=JSON.parse(Buffer.from(value,'base64url').toString());
  if(kind==='ledger'){if(!Number.isSafeInteger(row.id)||row.id<=0)throw 0;}
  else if(typeof row.id!=='string'||!row.id||row.id.length>100||typeof row.at!=='string'||row.at.length>40||!Number.isFinite(Date.parse(row.at)))throw 0;
  return row;
 }catch{throw new AppError('记录位置无效，请重新读取',400);}
}
const encode=row=>Buffer.from(JSON.stringify(row)).toString('base64url');
export function createAdminCustomerHistory(store,scope){
 const db=store.db;
 db.exec('CREATE INDEX IF NOT EXISTS assignments_owner_records ON assignments(owner_id,created_at DESC,id DESC)');
 function check(operator,id){scope.assertUser(operator,id);if(!db.prepare('SELECT 1 FROM creator_accounts WHERE id=?').get(id))throw new AppError('客户不存在',404);}
 return {
  records(operator,id,input={}){
   check(operator,id);const before=cursor(input.cursor,'records');
   const total=db.prepare('SELECT COUNT(*) n FROM assignments WHERE owner_id=?').get(id).n;
   const rows=db.prepare(`SELECT a.id,a.owner_id,a.status,a.created_at,t.title,
    COALESCE(f.amount,t.deposit) amount,
    CASE WHEN f.assignment_id IS NOT NULL THEN f.commission WHEN p.rate_bps IS NULL THEN t.commission ELSE CAST(ROUND(t.deposit*p.rate_bps/10000.0) AS INTEGER) END commission
    FROM assignments a JOIN tasks t ON t.id=a.task_id LEFT JOIN assignment_terms f ON f.assignment_id=a.id LEFT JOIN commission_policy p ON p.id=1
    WHERE a.owner_id=? ${before?'AND (a.created_at<? OR (a.created_at=? AND a.id<?))':''}
    ORDER BY a.created_at DESC,a.id DESC LIMIT 26`).all(id,...(before?[before.at,before.at,before.id]:[]));
   const selected=rows.slice(0,limit),last=selected.at(-1);
   return {items:selected.map(({title,amount,commission,...row})=>({...row,task:{title,deposit:amount,commission}})),total,nextCursor:rows.length>limit?encode({at:last.created_at,id:last.id}):null};
  },
  ledger(operator,id,input={}){
   check(operator,id);const before=cursor(input.cursor,'ledger'),total=db.prepare('SELECT COUNT(*) n FROM ledger WHERE owner_id=?').get(id).n;
   const rows=db.prepare('SELECT id,owner_id,kind,amount,balance_after,note,created_at FROM ledger WHERE owner_id=?'+(before?' AND id<?':'')+' ORDER BY id DESC LIMIT 26').all(id,...(before?[before.id]:[])),items=rows.slice(0,limit);
   return {items,total,nextCursor:rows.length>limit?encode({id:items.at(-1).id}):null};
  },
 };
}
