export function customerOverview(store, operator, now=new Date()) {
  const timeZone='Asia/Shanghai';
  const today=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const start=new Date(today+'T00:00:00+08:00').toISOString(),end=new Date(Date.parse(start)+86400000).toISOString();
  const blank=()=>({customers:0,registeredToday:0,available:0,totalCommission:0,todayCommission:0,totalDeposits:0,todayDeposits:0,totalWithdrawals:0,todayWithdrawals:0,todayWithdrawalApplications:0,pendingDeposits:0,pendingDepositCount:0,pendingWithdrawals:0,pendingWithdrawalCount:0,pendingIdentityCount:0});
  const groups={real:blank(),test:blank()};
  const scope="JOIN invitations i ON i.id=a.invite_id WHERE (?='super' OR i.owner_id=?)";
  const users=store.db.prepare(`SELECT a.customer_type AS type,COUNT(*) customers,
    SUM(CASE WHEN datetime(a.created_at)>=datetime(?) AND datetime(a.created_at)<datetime(?) THEN 1 ELSE 0 END) registeredToday,
    SUM(CASE WHEN (SELECT status FROM identities WHERE user_id=a.id ORDER BY created_at DESC,rowid DESC LIMIT 1)='review' THEN 1 ELSE 0 END) pendingIdentityCount
    FROM creator_accounts a ${scope} GROUP BY a.customer_type`).all(start,end,operator.role,operator.id);
  const ledger=store.db.prepare(`SELECT a.customer_type AS type,SUM(l.amount) available,
    SUM(CASE WHEN l.kind='reward' THEN l.amount ELSE 0 END) totalCommission,
    SUM(CASE WHEN l.kind='reward' AND datetime(l.created_at)>=datetime(?) AND datetime(l.created_at)<datetime(?) THEN l.amount ELSE 0 END) todayCommission
    FROM creator_accounts a JOIN ledger l ON l.owner_id=a.id ${scope} GROUP BY a.customer_type`).all(start,end,operator.role,operator.id);
  const funds=store.db.prepare(`SELECT a.customer_type AS type,
    SUM(CASE WHEN f.kind='deposit' AND f.status='completed' THEN f.amount ELSE 0 END) totalDeposits,
    SUM(CASE WHEN f.kind='deposit' AND f.status='completed' AND datetime(f.reviewed_at)>=datetime(?) AND datetime(f.reviewed_at)<datetime(?) THEN f.amount ELSE 0 END) todayDeposits,
    SUM(CASE WHEN f.kind='withdrawal' AND f.status='paid' THEN f.amount ELSE 0 END) totalWithdrawals,
    SUM(CASE WHEN f.kind='withdrawal' AND f.status='paid' AND datetime(COALESCE(f.paid_at,f.reviewed_at))>=datetime(?) AND datetime(COALESCE(f.paid_at,f.reviewed_at))<datetime(?) THEN f.amount ELSE 0 END) todayWithdrawals,
    SUM(CASE WHEN f.kind='withdrawal' AND datetime(f.created_at)>=datetime(?) AND datetime(f.created_at)<datetime(?) THEN f.amount ELSE 0 END) todayWithdrawalApplications,
    SUM(CASE WHEN f.kind='deposit' AND f.status='review' THEN f.amount ELSE 0 END) pendingDeposits,
    SUM(CASE WHEN f.kind='deposit' AND f.status='review' THEN 1 ELSE 0 END) pendingDepositCount,
    SUM(CASE WHEN f.kind='withdrawal' AND f.status IN ('review','paying') THEN f.amount ELSE 0 END) pendingWithdrawals,
    SUM(CASE WHEN f.kind='withdrawal' AND f.status IN ('review','paying') THEN 1 ELSE 0 END) pendingWithdrawalCount
    FROM creator_accounts a JOIN fund_requests f ON f.user_id=a.id ${scope} GROUP BY a.customer_type`).all(start,end,start,end,start,end,operator.role,operator.id);
  for(const row of [...users,...ledger,...funds]){const {type,...values}=row;if(groups[type])for(const [key,value]of Object.entries(values))groups[type][key]=value??0;}
  return {today,timeZone,updatedAt:now.toISOString(),groups};
}
