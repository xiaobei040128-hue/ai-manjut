import {AppError} from './store.mjs';
const filters={all:null,activity:['activity_reward','registration_reward','onboarding_reward'],commission:['reward','referral_reward'],held:['hold','withdraw_hold'],returned:['release','refund','withdraw_refund']};
const locales=new Set(['en-US','zh-SG','fr-FR','de-DE','es-ES','pt-PT','ka-GE','ru-RU','ar-EG','id-ID']);
export function createCustomerLedger(store){
 const db=store.db,formatters=new Map();
 const format=(amount,locale)=>{if(!formatters.has(locale))formatters.set(locale,new Intl.NumberFormat(locale,{minimumFractionDigits:2,maximumFractionDigits:2}));return formatters.get(locale).format(Number(amount)/100);};
 db.function('customer_ledger_amount',{deterministic:true},format);
 db.function('customer_ledger_search',{deterministic:true},value=>String(value||'').toLowerCase());
 const note="CASE WHEN kind='admin_credit' AND substr(note,1,4)='后台上分' THEN '余额增加'||substr(note,5) WHEN kind='admin_debit' AND substr(note,1,4)='后台下分' THEN '余额减少'||substr(note,5) WHEN kind='withdraw_hold' AND substr(note,1,6)='提现申请冻结' THEN '提现处理中'||substr(note,7) ELSE note END";
 return {page(user,input={}){
  const filter=input.filter||'all',q=(input.q||'').trim(),locale=input.locale||'en-US',limit=input.limit===undefined?25:Number(input.limit),before=input.before===undefined||input.before===null||input.before===''?null:Number(input.before);
  if(!Object.hasOwn(filters,filter)||q.length>200||!locales.has(locale)||!Number.isInteger(limit)||limit<1||limit>50||before!==null&&(!Number.isSafeInteger(before)||before<1))throw new AppError('记录筛选无效');
  const clauses=['owner_id=?'],args=[user];if(filters[filter]){clauses.push('kind IN ('+filters[filter].map(()=>'?').join(',')+')');args.push(...filters[filter]);}if(q){clauses.push('(instr(customer_ledger_search('+note+'),?)>0 OR instr(customer_ledger_amount(amount,?),?)>0)');args.push(q.toLowerCase(),locale,q);}
  const where=clauses.join(' AND '),total=db.prepare('SELECT COUNT(*) n FROM ledger WHERE '+where).get(...args).n,rows=db.prepare('SELECT * FROM ledger WHERE '+where+(before?' AND id<?':'')+' ORDER BY id DESC LIMIT ?').all(...args,...(before?[before]:[]),limit+1),items=rows.slice(0,limit);
  return {items,total,nextBefore:rows.length>limit?items.at(-1).id:null};
 }};
}
