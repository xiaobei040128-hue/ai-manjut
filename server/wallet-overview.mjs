import {customerLocalDate,customerDayBounds} from './customer-clock.mjs';
export function walletOverview(store,userId,now=new Date()){
 const db=store.db;let timeZone='Asia/Shanghai';if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='customer_timezones'").get())timeZone=db.prepare('SELECT time_zone FROM customer_timezones WHERE owner_id=?').get(userId)?.time_zone||timeZone;
 const {start,end}=customerDayBounds(customerLocalDate(now,timeZone),timeZone),today="julianday(created_at)>=julianday(?) AND julianday(created_at)<julianday(?)";
 const totals=db.prepare("SELECT COALESCE(SUM(amount),0) totalIncome,COALESCE(SUM(CASE WHEN kind='reward' THEN amount ELSE 0 END),0) totalCommission,COALESCE(SUM(CASE WHEN "+today+" THEN amount ELSE 0 END),0) todayIncome,COALESCE(SUM(CASE WHEN kind='reward' AND "+today+" THEN amount ELSE 0 END),0) todayCommission FROM ledger WHERE owner_id=? AND kind IN ('reward','registration_reward','onboarding_reward','activity_reward')").get(start,end,start,end,userId),wallet=store.asUser(userId,()=>store.summary({taskView:true,assignmentIds:[]}).wallet);
 return {...totals,processing:wallet.held,timeZone};
}
