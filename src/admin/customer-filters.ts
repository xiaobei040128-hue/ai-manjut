import type {Customer} from './customerTypes';

export type CustomerFilters = {
  query:string; customerType:string; identity:string; pending:string;
  stage:string; account:string; registeredFrom:string; registeredTo:string; sort:string;
};
export const emptyCustomerFilters:CustomerFilters = {
  query:'',customerType:'all',identity:'all',pending:'all',stage:'all',account:'all',
  registeredFrom:'',registeredTo:'',sort:'balance',
};
export function registrationDay(value:string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
function pendingCount(c:Customer) {
  return (c.identity_status==='review'?1:0)+(c.pending_deposits||0)+(c.pending_withdrawals||0)+(c.pending_cards||0);
}
export function filterCustomers(rows:Customer[],filter:CustomerFilters):Customer[] {
  if(filter.registeredFrom && filter.registeredTo && filter.registeredFrom>filter.registeredTo) return [];
  return rows.filter(c=>{
    const day=registrationDay(c.created_at),pending=pendingCount(c);
    return [c.name,c.email,c.id,c.agent_username,c.agent_name].join(' ').toLowerCase().includes(filter.query.trim().toLowerCase())
      && (filter.customerType==='all'||(c.customer_type||'real')===filter.customerType)
      && (filter.identity==='all'||c.identity_status===filter.identity)
      && (filter.stage==='all'||String(c.progress?.stage||1)===filter.stage)
      && (filter.account==='all'||(filter.account==='frozen'?!!c.frozen:!c.frozen))
      && (!filter.registeredFrom||day>=filter.registeredFrom)
      && (!filter.registeredTo||!!day&&day<=filter.registeredTo)
      && (filter.pending==='all'||filter.pending==='any'&&pending>0||filter.pending==='none'&&pending===0
        ||filter.pending==='identity'&&c.identity_status==='review'
        ||filter.pending==='deposit'&&(c.pending_deposits||0)>0
        ||filter.pending==='withdrawal'&&(c.pending_withdrawals||0)>0
        ||filter.pending==='card'&&(c.pending_cards||0)>0);
  }).sort((a,b)=>filter.sort==='newest'?b.created_at.localeCompare(a.created_at)
    :filter.sort==='oldest'?a.created_at.localeCompare(b.created_at)
    :filter.sort==='pending'?pendingCount(b)-pendingCount(a):b.wallet.available-a.wallet.available);
}
