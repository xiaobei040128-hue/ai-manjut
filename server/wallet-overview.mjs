const dayAt=(date,timeZone)=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);return ['year','month','day'].map(type=>parts.find(p=>p.type===type).value).join('-');};
export function walletOverview(store,userId,now=new Date()){
 const db=store.db;let timeZone='Asia/Shanghai';if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='customer_timezones'").get())timeZone=db.prepare('SELECT time_zone FROM customer_timezones WHERE owner_id=?').get(userId)?.time_zone||timeZone;
 const day=dayAt(now,timeZone),rewards=db.prepare("SELECT amount,created_at FROM ledger WHERE owner_id=? AND kind='reward'").all(userId),wallet=store.asUser(userId,()=>store.summary().wallet);
 return {todayCommission:rewards.filter(r=>dayAt(new Date(r.created_at),timeZone)===day).reduce((sum,r)=>sum+r.amount,0),totalCommission:rewards.reduce((sum,r)=>sum+r.amount,0),processing:wallet.held,timeZone};
}
