import {copyTaskCode as copyText} from './task-clipboard';
import {useEffect,useState} from 'react';
import {api,date} from '../api';
import {amountNumber as money} from './task-display';
import {translateText as tx} from '../i18n/translate';
import './referrals.css';
type Summary={code:string;ratePercent:number;invitedCount:number;earned:number;members:{name:string;createdAt:string}[];settlements:{name:string;batch:number;commission:number;ratePercent:number;amount:number;createdAt:string}[]};
export default function Referrals(){
 const [data,setData]=useState<Summary|null>(null),[error,setError]=useState(''),[copied,setCopied]=useState(''),[expanded,setExpanded]=useState(false);
 useEffect(()=>{
  let live=true,pending=false;
  async function refresh(){
   if(pending||document.hidden)return;
   pending=true;
   try{
    const summary=await api<Summary>('/referrals');
    if(live){setData(summary);setError('');}
   }catch(e){if(live)setError((e as Error).message);}
   finally{pending=false;}
  }
  void refresh();
  const timer=window.setInterval(refresh,15000);
  window.addEventListener('focus',refresh);
  document.addEventListener('visibilitychange',refresh);
  return()=>{
   live=false;
   window.clearInterval(timer);
   window.removeEventListener('focus',refresh);
   document.removeEventListener('visibilitychange',refresh);
  };
 },[]);

 async function copy(value:string){try{await copyText(value);setCopied('已复制');}catch{setCopied('请长按复制');}}
 const link=data?location.origin+'/?auth=register&invite='+encodeURIComponent(data.code):'';
 return <section className="personal-referrals" aria-labelledby="referral-title"><header><div><h2 id="referral-title">{tx('邀请与佣金')}</h2></div></header>{error&&<p role="alert">{tx(error)}</p>}{!data&&!error&&<p role="status">{tx('正在加载…')}</p>}{data&&<><div className="referral-stats"><div><span>{tx('直属邀请人数')}</span><b>{data.invitedCount}</b></div><div><span>{tx('累计邀请佣金')}</span><b>{money(data.earned)}</b></div></div><div className="referral-share-row"><div><span className="referral-share-label">{tx('我的邀请码')}</span><code>{data.code}</code></div><button aria-label={tx('我的邀请码')+' · '+tx('复制')} onClick={()=>void copy(data.code)}>{tx('复制')}</button></div><div className="referral-share-row"><div><span className="referral-share-label">{tx('邀请链接')}</span><span className="referral-domain">{location.host}</span></div><button aria-label={tx('复制邀请链接')} onClick={()=>void copy(link)}>{tx('复制')}</button></div><p role="status" className="referral-copy-status">{tx(copied)}</p><button className="referral-expand" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{tx(expanded?'收起记录':'查看邀请与结算记录')} <span>{expanded?'−':'＋'}</span></button>{expanded&&<div className="referral-details"><h3>{tx('直属成员')}</h3>{data.members.length?data.members.map((m,i)=><div className="referral-member" key={i}><span>{m.name}</span><small>{date(m.createdAt)}</small></div>):<p>{tx('暂无邀请记录')}</p>}<h3>{tx('邀请佣金明细')}</h3>{data.settlements.length?data.settlements.map((s,i)=><article className="referral-receipt" key={i}><div><b>{s.name}</b><small>{date(s.createdAt,true)}</small></div><strong>+{money(s.amount)}</strong><p>{tx('任务佣金')} {money(s.commission)}</p></article>):<p>{tx('暂无结算记录')}</p>}</div>}</>}</section>;
}
