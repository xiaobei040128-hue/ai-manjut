import {AppError} from './store.mjs';
export function createOperatorScope(store){
 const db=store.db;
 function users(op){return op.role==='super'?null:new Set(db.prepare('SELECT a.id FROM creator_accounts a JOIN invitations i ON i.id=a.invite_id WHERE i.owner_id=?').all(op.id).map(r=>r.id));}
 function assertUser(op,id){if(op.role!=='super'&&!users(op).has(id))throw new AppError('无权访问此客户',403);}
 function assertTarget(op,type,id){if(op.role==='super')return;const table={identity:'identities',bank:'bank_cards',fund:'fund_requests',assignment:'assignments'}[type];if(!table){assertUser(op,id);return;}const row=db.prepare('SELECT '+(type==='assignment'?'owner_id':'user_id')+' AS user_id FROM '+table+' WHERE id=?').get(id);if(!row)throw new AppError('记录不存在',404);assertUser(op,row.user_id);}
 return {users,assertUser,assertTarget,
  filterUsers(op,rows){const allowed=users(op);return allowed?rows.filter(r=>allowed.has(r.id)):rows;},
  finance(op,snapshot){const allowed=users(op);return allowed?{users:snapshot.users.filter(r=>allowed.has(r.id)),identities:snapshot.identities.filter(r=>allowed.has(r.user_id)),cards:snapshot.cards.filter(r=>allowed.has(r.user_id)),requests:snapshot.requests.filter(r=>allowed.has(r.user_id))}:snapshot;},
  summary(op){const ids=users(op),all=store.summary(ids?{owners:[...ids]}:{});if(op.role==='super')return all;const assignments=all.assignments.filter(a=>ids.has(a.owner_id)),ledger=all.ledger.filter(r=>ids.has(r.owner_id)),withdrawalHeld=db.prepare("SELECT user_id,amount FROM fund_requests WHERE kind='withdrawal' AND status IN ('review','paying')").all().filter(r=>ids.has(r.user_id)).reduce((n,r)=>n+r.amount,0);return {...all,profile:{id:0,name:op.username,bio:'代理客户工作区',channel:'',created_at:''},assignments,ledger,notifications:[],notificationsUnread:0,bookmarks:[],savedTasks:[],counts:{active:assignments.filter(a=>['active','revision'].includes(a.status)).length,review:assignments.filter(a=>a.status==='review').length,completed:assignments.filter(a=>a.status==='completed').length},wallet:{...all.wallet,available:ledger.reduce((n,r)=>n+r.amount,0),held:(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='task_balance_reservations'").get()?db.prepare("SELECT owner_id,amount FROM task_balance_reservations WHERE state='reserved'").all().filter(r=>ids.has(r.owner_id)).reduce((n,r)=>n+r.amount,0):0)+(all.wallet.coverHeld||0)+(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='community_license_orders'").get()?db.prepare("SELECT owner_id,amount FROM community_license_orders WHERE state='purchased'").all().filter(r=>ids.has(r.owner_id)).reduce((n,r)=>n+r.amount,0):0)+withdrawalHeld+assignments.filter(a=>['active','review','revision'].includes(a.status)).reduce((n,a)=>n+a.task.deposit,0),earned:ledger.filter(r=>r.kind==='reward').reduce((n,r)=>n+r.amount,0),withdrawalHeld},tasks:all.tasks.map(t=>({...t,bookmarked:false}))};},
  guard(op,path,method){if(op.role==='super')return;
   if(path==='/api/admin/commission-policy')throw new AppError('仅总后台可配置佣金比例',403);
   if(path==='/api/admin/premium-dispatch'&&method==='GET'||/^\/api\/admin\/premium-dispatch\/[^/]+$/.test(path)&&method==='POST')return;
   if(path==='/api/admin/stage-enrollments'&&method==='GET'||/^\/api\/admin\/stage-enrollments\/[^/]+\/review$/.test(path)&&method==='POST')return;
   if(path==='/api/admin/activity-rewards' &&method==='GET'||/^\/api\/admin\/activity-rewards\/[^/]+\/grant$/.test(path)&&method==='POST')return;
   if(/\/account\/[^/]+\/adjust$/.test(path))throw new AppError('普通发放员不能直接上下分，请使用已授权的活动奖励',403);
   const customer=path.match(/^\/api\/admin\/accounts\/([^/]+)\/(notes|revoke-sessions)$/);if(customer){assertUser(op,customer[1]);return;}
   if(['/api/admin/bootstrap','/api/admin/accounts','/api/admin/finance','/api/admin/invitations','/api/export/ledger'].includes(path))return;
   const revoke=path.match(/^\/api\/admin\/invitations\/([^/]+)\/revoke$/);if(revoke){const invite=db.prepare('SELECT owner_id FROM invitations WHERE id=?').get(revoke[1]);if(invite?.owner_id!==op.id)throw new AppError('无权管理此邀请码',403);return;}
   const finance=path.match(/^\/api\/admin\/finance\/(identity|bank|fund|account)\/([^/]+)\/(review|reveal|adjust|freeze|photos\/(?:front|back))$/);if(finance){assertTarget(op,finance[1],finance[2]);return;}
   const review=path.match(/^\/api\/assignments\/([^/]+)\/review$/);if(review){assertTarget(op,'assignment',review[1]);return;}
   throw new AppError('此功能仅限总后台',403);
  }
 };
}
