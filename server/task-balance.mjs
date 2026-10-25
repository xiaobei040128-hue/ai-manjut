import {AppError} from './store.mjs';

// Reservations are real ledger holds, distinct from purchased task principal.
export function createTaskBalance(store){
 const db=store.db;
 db.exec(`CREATE TABLE IF NOT EXISTS task_balance_reservations(
  owner_id TEXT NOT NULL,kind TEXT NOT NULL,reference_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount>=0),state TEXT NOT NULL CHECK(state IN ('reserved','converted','released')),
  created_at TEXT NOT NULL,converted_at TEXT,cycle INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(kind,reference_id));`);
 db.exec("CREATE INDEX IF NOT EXISTS task_balance_owner_state ON task_balance_reservations(owner_id,state)");
 const row=(user,kind,reference)=>db.prepare('SELECT * FROM task_balance_reservations WHERE owner_id=? AND kind=? AND reference_id=?').get(user,kind,reference);
 function post(user,kind,amount,key,note){
  const balance=db.prepare('SELECT COALESCE(SUM(amount),0) n FROM ledger WHERE owner_id=?').get(user).n;
  if(balance+amount<0)throw new AppError('可用余额不足，请先补齐差额',409);
  db.prepare('INSERT INTO ledger(kind,amount,balance_after,note,operation_key,created_at,owner_id) VALUES(?,?,?,?,?,?,?)').run(kind,amount,balance+amount,note,key,new Date().toISOString(),user);
 }
 return {
  amount(user,kind,reference){const r=row(user,kind,reference);return r?r.state==='reserved'?r.amount:0:null;},
  reserve(user,kind,reference,total,title){return store.asUser(user,()=>store.audited(user,'task.balance.reserve',reference,()=>{
   const old=row(user,kind,reference);if(old?.state==='converted')return 0;
   if(!Number.isSafeInteger(total)||total<0)throw new AppError('任务金额无效');
   const available=db.prepare('SELECT COALESCE(SUM(amount),0) n FROM ledger WHERE owner_id=?').get(user).n;
   const cycle=old?.state==='released'?old.cycle+1:old?.cycle||0;
   const previous=old?.state==='reserved'?old.amount:0,extra=Math.min(Math.max(0,total-previous),Math.max(0,available)),amount=previous+extra;
   if(!old)db.prepare("INSERT INTO task_balance_reservations(owner_id,kind,reference_id,amount,state,created_at) VALUES(?,?,?,?,'reserved',?)").run(user,kind,reference,amount,new Date().toISOString());
   else if(extra||old.state==='released')db.prepare("UPDATE task_balance_reservations SET amount=?,state='reserved',cycle=?,converted_at=NULL WHERE owner_id=? AND kind=? AND reference_id=?").run(amount,cycle,user,kind,reference);
   if(extra)post(user,'hold',-extra,'task-reserve:'+kind+':'+reference+':'+cycle+':'+amount,'任务余额抵扣 · '+title);
   return amount;
  }));},
  release(user,kind,reference){const r=row(user,kind,reference);if(!r||r.state!=='reserved')return 0;
   if(r.amount)post(user,'release',r.amount,'task-reserve-release:'+kind+':'+reference+':'+r.cycle,'取消领取 · 余额退回');
   db.prepare("UPDATE task_balance_reservations SET state='released' WHERE owner_id=? AND kind=? AND reference_id=?").run(user,kind,reference);return r.amount;
  },
  // Must run in the SAME audited transaction as the complete purchase hold.
  convert(user,kind,reference){const r=row(user,kind,reference);if(!r||r.state!=='reserved')return 0;
   if(r.amount)post(user,'release',r.amount,'task-reserve-convert:'+kind+':'+reference+':'+r.cycle,'任务预留转入购买');
   db.prepare("UPDATE task_balance_reservations SET state='converted',converted_at=? WHERE owner_id=? AND kind=? AND reference_id=?").run(new Date().toISOString(),user,kind,reference);
   return r.amount;
  }
 };
}
