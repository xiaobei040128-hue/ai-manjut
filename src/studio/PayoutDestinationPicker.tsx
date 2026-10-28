import {translateText as tx,localizeNode as lx} from "../i18n/translate";
import {useState} from 'react';
import {payoutMethodName,type FinanceCard} from '../finance';
import ChannelIcon from '../ChannelIcon';
export default function PayoutDestinationPicker({cards,value,onChange}:{cards:FinanceCard[];value:string;onChange:(id:string)=>void}){
 const [open,setOpen]=useState(false),selected=cards.find(c=>c.id===value);
 return <div className="payout-destination"><button type="button" className="payout-destination-trigger" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><span>{lx(selected?<><b>{lx(selected.provider==='bank'?'银行转账':payoutMethodName(selected))}</b><small>{lx(selected.number_mask)}</small></>:'请选择收款方式')}</span><span aria-hidden="true">{lx(open?'⌃':'⌄')}</span></button>{lx(open&&<div className="payout-destination-options" role="radiogroup" aria-label={tx("选择收款方式")} onKeyDown={e=>{if(e.key==='Escape')setOpen(false);}}>{lx(cards.map(c=><label key={c.id} className="payout-destination-option"><input type="radio" name="payout-destination" value={c.id} checked={value===c.id} onChange={()=>{onChange(c.id);setOpen(false);}}/><ChannelIcon id={c.provider==='bank'?'bank_wire':c.provider||'bank_wire'}/><span><b title={c.provider==='bank'?payoutMethodName(c):tx(payoutMethodName(c))}>{c.provider==='bank'?payoutMethodName(c):lx(payoutMethodName(c))}</b><small>{c.number_mask}</small></span></label>))}</div>)}{lx(selected?.provider==='bank'&&<small className="payout-selected-bank" title={selected.bank}>{selected.bank}</small>)}</div>;
}
