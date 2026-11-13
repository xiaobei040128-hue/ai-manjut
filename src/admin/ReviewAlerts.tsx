import {useEffect,useRef,useState} from 'react';
import {BellIcon} from '@radix-ui/react-icons';
import {api,ApiError} from '../api';
import {pendingReviews,newReviewKeys,type ReviewSnapshot} from './review-alert-state';
import './review-alerts.css';

export default function ReviewAlerts({operatorKey,title}:{operatorKey:string;title:string}){
 const storageKey='ai-creator-review-notifications:'+operatorKey;
 const [counts,setCounts]=useState({identities:0,withdrawals:0}),[unread,setUnread]=useState(false),[connected,setConnected]=useState(false),[error,setError]=useState(''),[desktop,setDesktop]=useState(()=>{try{return localStorage.getItem(storageKey)==='on';}catch{return false;}}),[notice,setNotice]=useState(''),[requesting,setRequesting]=useState(false);
 const previous=useRef<Set<string>|null>(null),unseen=useRef(new Set<string>()),enabled=useRef(desktop),alive=useRef(false),notification=useRef<Notification|null>(null);
 enabled.current=desktop;
 useEffect(()=>{
  alive.current=true;let busy=false,expired=false,cancelled=false;
  const notify=(total:number)=>{
   if(!enabled.current||!('Notification' in window)||Notification.permission!=='granted')return;
   // One browser alert per operator across tabs; a tab taking focus can still
   // show the persistent queue counts even when another tab displayed the alert.
   try{const key=storageKey+':last-alert',last=Number(localStorage.getItem(key)||0);if(Date.now()-last<1000)return;localStorage.setItem(key,String(Date.now()));}catch{}
   try{notification.current?.close();const n=new Notification('AI CREATOR · 新待审批申请',{body:'新增 '+total+' 项提款申请，请打开后台处理。',tag:'creator-review-'+operatorKey,icon:'/icons/ai-creator-approved.png'});notification.current=n;n.onclick=()=>{window.focus();location.hash='finance';n.close();};}catch{}
  };
  const load=async()=>{
   if(busy||expired||document.hidden)return;busy=true;
   try{
    const data=await api<ReviewSnapshot>('/admin/review-notices');if(cancelled)return;
    const next=pendingReviews({...data,identities:[]}),fresh=newReviewKeys(previous.current,next.keys),current=new Set(next.keys);
    for(const key of unseen.current)if(!current.has(key))unseen.current.delete(key);
    fresh.forEach(key=>unseen.current.add(key));previous.current=current;
    setCounts({identities:next.identities,withdrawals:next.withdrawals});setUnread(unseen.current.size>0);setConnected(true);setError('');
    if(fresh.length)notify(fresh.length);
   }catch(e){if(cancelled)return;if(e instanceof ApiError&&e.status===401){expired=true;unseen.current.clear();setUnread(false);setCounts({identities:0,withdrawals:0});setConnected(false);setError('登录已失效，请重新登录');notification.current?.close();}else setError('提醒暂未更新，请检查连接');}
   finally{busy=false;}
  };
  void load();const timer=window.setInterval(()=>void load(),15000);
  const focus=()=>void load(),change=()=>{if(!document.hidden)void load();};
  window.addEventListener('focus',focus);window.addEventListener('creator-review-updated',focus);document.addEventListener('visibilitychange',change);
  return()=>{cancelled=true;alive.current=false;clearInterval(timer);window.removeEventListener('focus',focus);window.removeEventListener('creator-review-updated',focus);document.removeEventListener('visibilitychange',change);notification.current?.close();};
 },[operatorKey,storageKey]);
 const total=counts.identities+counts.withdrawals;
 useEffect(()=>{
  const ordinary=total?'（待审批 '+total+'）'+title:title;
  let flash=false;const show=()=>{document.title=unread&&document.hidden?(flash?'【新申请待审批】':'【请查看后台】')+' '+ordinary:ordinary;flash=!flash;};
  show();const timer=window.setInterval(show,1500);document.addEventListener('visibilitychange',show);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',show);document.title=title;};
 },[title,total,unread]);
 const acknowledge=()=>{unseen.current.clear();setUnread(false);};
 const enable=async()=>{
  if(desktop){setDesktop(false);try{localStorage.setItem(storageKey,'off');}catch{}notification.current?.close();return;}
  if(!('Notification' in window)){setNotice('当前浏览器不支持桌面通知，页面和标签提醒仍可使用。');return;}
  setRequesting(true);
  try{const permission=Notification.permission==='default'?await Notification.requestPermission():Notification.permission;if(!alive.current)return;if(permission==='granted'){setDesktop(true);try{localStorage.setItem(storageKey,'on');}catch{}setNotice('桌面通知已开启，收到新申请时提醒。');}else setNotice('桌面通知未获授权，页面和标签提醒仍可使用。');}catch{if(alive.current)setNotice('无法开启桌面通知，页面和标签提醒仍可使用。');}finally{if(alive.current)setRequesting(false);}
 };
 return <section className={'ad-review-alerts'+(unread?' has-new':'')} aria-label="审批提醒">
  <BellIcon aria-hidden="true"/><div className="ad-review-alert-copy"><strong role="status" aria-live="polite">{error||(!connected?'正在读取审批提醒…':total?'待审批：提款 '+counts.withdrawals:'暂无提款待审批')}{unread&&<span className="ad-review-new">有新申请</span>}</strong><small>{notice||'后台打开期间每15秒检查；切回窗口时立即检查。'}</small></div>
  <div className="ad-review-alert-actions">{total>0&&<a href="#finance" onClick={acknowledge}>处理待办</a>}{unread&&<button type="button" onClick={acknowledge}>我知道了</button>}<button type="button" aria-pressed={desktop} disabled={requesting} onClick={()=>void enable()}>{requesting?'等待授权…':desktop?'关闭桌面通知':'开启桌面通知'}</button></div>
 </section>;
}
