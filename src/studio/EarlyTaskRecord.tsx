import {date,money,statusText} from '../api';
import {translateText as tx} from '../i18n/translate';
import {CheckIcon,ClockIcon,ReaderIcon,ArrowRightIcon} from '@radix-ui/react-icons';
import {navigateApp} from './app-navigation';
import './early-task-record.css';
export interface EarlyTask {id:string;title:string;status:'active'|'review'|'revision'|'completed';created_at:string|null;reward:number;amount:number;stage:number;artwork:string}
export default function EarlyTaskRecord({record:r}:{record:EarlyTask}){
 const Icon=r.status==='completed'?CheckIcon:r.status==='review'?ClockIcon:ReaderIcon;
 return <article className="s-owned-card early-task-record">
  <div className="early-record-heading">
   <span className={'early-record-icon '+r.status} aria-hidden="true"><Icon/></span>
   <div className="early-record-copy"><span className="early-record-stage">{tx(r.stage===1?'创作启航':'灵感成章')}</span><h3>{tx(r.title)}</h3></div>
   <span className={'s-status '+r.status}>{tx(statusText[r.status])}</span>
  </div>
  {r.artwork&&<p className="early-record-artwork">{r.artwork}</p>}
  {r.amount>0&&<p className="early-record-purchase">{tx('购买金额')} · {money(r.amount)}</p>}
  {(r.created_at||r.reward>0)&&<div className="early-record-footer">
   {r.created_at&&<time className="early-record-time" dateTime={r.created_at}>{date(r.created_at,true)}</time>}
   {r.reward>0&&<b className="early-record-reward" aria-label={tx('完成奖励')+' '+money(r.reward)}>+{money(r.reward)}</b>}
  </div>}
  {r.status!=='completed'&&<button type="button" className="early-record-action" onClick={()=>navigateApp(r.id==='identity'?'/?page=wallet&finance=identity':r.stage===1?'/?design=newcomer':'/?design=advanced')}>{tx('查看任务')}<ArrowRightIcon/></button>}
 </article>;
}
