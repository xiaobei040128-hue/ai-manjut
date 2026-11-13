import {createHash} from 'node:crypto';
import {AppError} from './store.mjs';
import {DAILY_TASK_LIMIT} from './third-plan.mjs';

export function createCustomerTaskReset(store, dispatch) {
 const {db}=store;
 function read(id) {
  if(!db.prepare('SELECT 1 FROM creator_accounts WHERE id=?').get(id))throw new AppError('客户不存在',404);
  const batch=db.prepare('SELECT batch FROM third_plans WHERE owner_id=?').get(id)?.batch??0;
  const start=batch*DAILY_TASK_LIMIT,end=start+DAILY_TASK_LIMIT;
  const slots=db.prepare(`SELECT i.assignment_id,a.status FROM third_plan_items i JOIN assignments a ON a.id=i.assignment_id
   WHERE i.owner_id=? AND a.owner_id=? AND i.position>=? AND i.position<? ORDER BY i.position`).all(id,id,start,end);
  const purchased=db.prepare(`SELECT a.id,a.status,t.amount AS deposit FROM assignments a JOIN assignment_terms t ON t.assignment_id=a.id
   WHERE a.owner_id=? AND t.stage=3 AND a.status IN ('active','review','revision') ORDER BY a.id`).all(id);
  const offers=db.prepare(`SELECT o.id,COALESCE(r.amount,0) amount FROM stage_task_offers o LEFT JOIN task_balance_reservations r
   ON r.owner_id=o.owner_id AND r.kind='stage' AND r.reference_id=o.id AND r.state='reserved'
   WHERE o.owner_id=? AND o.stage=3 AND o.assignment_id IS NULL AND o.retired=0 ORDER BY o.id`).all(id);
  const refund=offers.reduce((sum,row)=>sum+row.amount,0)+purchased.reduce((sum,row)=>sum+row.deposit,0);
  const token=createHash('sha256').update(JSON.stringify([id,batch,slots,purchased,offers])).digest('hex');
  const preview={token,batch:batch+1,completed:slots.filter(row=>row.status==='completed').length,refund,canReset:!!(slots.length||purchased.length||offers.length)};
  return {start,end,purchased,offers,preview};
 }
 return {
  preview:id=>read(id).preview,
  reset(actor,id,token){
   const detail={};
   return store.audited(actor,'customer.task_reset',id,()=>{
    const state=read(id),{preview}=state;
    if(!preview.canReset||preview.token!==token)throw new AppError('任务状态已变化，请重新预览',409);
    for(const offer of state.offers)dispatch.discard(id,offer.id,{administrative:true});
    for(const row of state.purchased)store.asUser(id,()=>store.cancel(row.id,{administrative:true}));
    db.prepare('UPDATE third_plan_items SET assignment_id=NULL WHERE owner_id=? AND position>=? AND position<?').run(id,state.start,state.end);
    Object.assign(detail,{batch:preview.batch,completed:preview.completed,refund:preview.refund});
    return detail;
   },detail);
  }
 };
}
