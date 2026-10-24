import {useCallback,useEffect,useRef,useState} from 'react';
import {LockClosedIcon,ReaderIcon,CheckIcon,ArrowRightIcon} from '@radix-ui/react-icons';
import {useAccountJourney} from './AccountJourney';
import JourneyEffects,{useJourneyAudio,type JourneyEvent} from './JourneyEffects';
import {useKeyboard} from '../mobile';
import {api} from '../api';
import './story-catalog.css';
import './license-gold.css';

import stories from './storyCatalog.json';
import {restoreReadingDay,type ReadingDay} from './readingQueue';
function readDay(key:string):ReadingDay{
 let saved:unknown=null;try{saved=JSON.parse(localStorage.getItem(key)||'null');}catch{}
 return restoreReadingDay(saved,stories.map(s=>s.id));
}
function ReadingSession({storageKey,day,replay=false,onReplay}:{storageKey:string;day:string;replay?:boolean;onReplay:()=>void}){
 const [record,setRecord]=useState(()=>replay?restoreReadingDay(null,stories.map(s=>s.id)):readDay(storageKey)),[opened,setOpened]=useState(false),[saveError,setSaveError]=useState(false),[receipt,setReceipt]=useState(''),[premium,setPremium]=useState(false),[dispatching,setDispatching]=useState(false),[dispatchError,setDispatchError]=useState('');
 const [effect,setEffect]=useState<JourneyEvent|null>(null),audio=useJourneyAudio(),keyboard=useKeyboard();
 const sequence=useRef(0),resolvedDispatch=useRef(0),locked=useRef(false),panel=useRef<HTMLElement|null>(null);
 const closeEffect=useCallback(()=>{setEffect(null);locked.current=false;requestAnimationFrame(()=>{panel.current?.querySelector<HTMLElement>('.license-feature')?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});panel.current?.querySelector<HTMLButtonElement>('.license-action')?.focus({preventScroll:true});});},[]);
 function announce(kind:JourneyEvent['kind'],title:string,subtitle:string){keyboard.hide();locked.current=true;setEffect({kind,title,subtitle,nonce:++sequence.current});audio.play(kind);}
 async function reveal(){if(locked.current||dispatching)return;setDispatching(true);setDispatchError('');try{const result=replay?{premium:false}:await api<{premium:boolean}>('/stage-three/premium-reveal','POST',{sequence:record.done+1});resolvedDispatch.current=record.done+1;setPremium(result.premium);setOpened(false);setReceipt('');setRecord(v=>({...v,revealed:true}));announce('task',result.premium?'高阶全集体验已抵达':stories.find(s=>s.id===record.order[record.done])!.title,result.premium?'专属全集剧集盒 · 为你开启新的探索':`第 ${record.done+1} 项 · 新的故事探索已揭晓`);}catch(e){setDispatchError((e as Error).message);}finally{setDispatching(false);}}
 useEffect(()=>{if(!record.revealed||replay||resolvedDispatch.current===record.done+1)return;let current=true;setDispatching(true);void api<{premium:boolean}>('/stage-three/premium-reveal','POST',{sequence:record.done+1}).then(r=>{if(current){resolvedDispatch.current=record.done+1;setPremium(r.premium);}}).catch(e=>{if(current)setDispatchError(e.message);}).finally(()=>{if(current)setDispatching(false);});return()=>{current=false;};},[record.done,record.revealed,replay]);

 function finish(){if(locked.current||!record.revealed||!opened||!receipt)return;const next=Math.min(record.done+1,record.count);setRecord(v=>({...v,done:next,revealed:false}));setOpened(false);announce(next===record.count?'complete':'reward',next===record.count?'版权探索全部完成':'本项探索已完成',`探索进度提升至 ${Math.round(next/record.count*100)}% · 体验已记录`);}
 useEffect(()=>{if(replay)return;try{localStorage.setItem(storageKey,JSON.stringify(record));setSaveError(false);}catch{setSaveError(true);}},[record,storageKey,replay]);
 useEffect(()=>{if(replay)return;function sync(e:StorageEvent){if(e.key===storageKey){setRecord(readDay(storageKey));setOpened(false);}}window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[storageKey,replay]);
 const complete=record.done===record.count,percent=Math.round(record.done/record.count*100),story=stories.find(s=>s.id===record.order[record.done]);
 return <section ref={panel} className={"license-preview"+(premium&&(record.revealed||!!effect)?" license-gold is-premium":"")} aria-label="版权商城演示">
  {replay&&<div className="license-replay-note"><span>独立回放 · 不修改账号进度</span><button onClick={onReplay}>退出回放</button></div>}
  <header><div><span>DAILY DISCOVERY · {day.slice(5)}</span><h2>版权探索</h2></div><b>{complete?'今日已完成':record.revealed?'进行中':'待揭晓'}</b></header>
  <div className="license-toolbar"><span>逐项揭晓 · 版权探索</span><button onClick={audio.toggle} aria-label={audio.enabled?'关闭音效':'开启音效'}>{audio.enabled?'♫ 音效已开':'♪ 音效已关'}</button></div>
  <div className="license-progress license-progress-rich"><div className="license-orbit"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27"/><circle className="license-orbit-fill" cx="32" cy="32" r="27" strokeDasharray="169.65" strokeDashoffset={169.65*(1-record.done/record.count)}/></svg><b key={record.done} aria-live="polite">{percent}<small>%</small></b></div><div className="license-progress-content"><span>探索进度 <b>{complete?'圆满完成':'持续推进中'}</b></span><progress aria-label="今日版权阅读进度" value={record.done} max={record.count}/><small>{record.done?'每一项探索，都留下你的足迹':'开启今天的第一份邀请'}</small></div></div>
  {dispatchError&&<p role="alert" className="t-error">{dispatchError}<button onClick={()=>void reveal()}>重新获取当前任务</button></p>}
  {saveError&&<p role="alert">浏览器存储不可用，刷新后可能无法保留本次进度。</p>}
  {complete?<div className="license-complete"><CheckIcon/><h3>版权探索已完成</h3><p>已完成 {record.count} 项阅读演示，明日再开启新的探索。</p><button className="license-action" onClick={onReplay}>{replay?'退出回放':'从头预览 · 不修改进度'}</button></div>:<>
   {premium&&record.revealed&&<div className="premium-banner"><span>PREMIUM COLLECTION</span><b>高阶 · 全集体验</b><small>当前指定序号专属体验</small></div>}
   <div className={"license-feature license-arrival"+(record.revealed?" has-story":"")} key={record.done}><div className={"license-art "+(!record.revealed?"is-sealed":"is-revealed")} role="img" aria-label={record.revealed?story?.title+'海报':'未揭晓的作品'}><div className="license-stack"/>{premium&&record.revealed&&<><i className="premium-spine"/><i className="premium-seal">全集</i></>}{!record.revealed?<img className="license-invite" src="/art/task-invitation-v1.png" alt="3D任务邀请函" draggable={false}/>:<img className="license-story-cover" src={story?.cover} alt={story?.title+'海报'} draggable={false}/>}<i className="license-spark spark-a"/><i className="license-spark spark-b"/><i className="license-spark spark-c"/><span>{record.revealed?story?.genre:'下一部作品 · 等待揭晓'}</span></div><div className="license-feature-copy"><span>DISCOVERY · {String(record.done+1).padStart(2,'0')}</span><h3>{record.revealed?story?.title:'一份新的探索，等待开启'}</h3><p>{record.revealed?story?.description:'完成当前探索后，再揭晓下一项。'}</p>
   {!record.revealed?<button className="license-action" disabled={dispatching} onClick={()=>void reveal()}>{dispatching?'正在读取派发…':'随机揭晓当前项'}<ArrowRightIcon/></button>:<button className="license-action" disabled={dispatching||!!dispatchError} aria-expanded={opened} onClick={()=>setOpened(v=>!v)}>{opened?'收起体验流程':premium?'开启全集体验':'体验授权流程'}<ReaderIcon/></button>}</div></div>
   {record.revealed&&<div className="lg-price"><span>授权价格</span><b>待配置</b><small>尚未提供权利人报价</small></div>}
   {record.revealed&&opened&&<div className="license-detail license-reading lg-checkout"><div className="license-detail-title"><ReaderIcon/><h4>{premium?'全集授权流程体验':'单集授权流程体验'}</h4><span>不办理真实交易</span></div><h3>{story?.title}</h3><p>{story?.description}</p><dl><div><dt>授权价格</dt><dd>待配置</dd></div><div><dt>权利人、范围与合同</dt><dd>待补充</dd></div></dl>{!receipt?<><p>体验仅生成演示订单编号，不付款，也不代表获得或转移版权。</p><button className="license-action" onClick={()=>setReceipt('DEMO-'+crypto.randomUUID().slice(0,8).toUpperCase())}>生成演示订单<ArrowRightIcon/></button></>:<><div className="lg-receipt"><span>演示订单编号</span><strong>{receipt}</strong><small>非版权凭证 · 非转移码</small></div><button className="license-action" onClick={finish}>完成本次体验<CheckIcon/></button></>}</div>}

  </>}
  {record.done>0&&<details className="license-history"><summary>已完成记录 · {record.done} 项</summary>{Array.from({length:record.done},(_,i)=><div key={i}><CheckIcon/><span>{String(i+1).padStart(2,'0')} · {stories.find(s=>s.id===record.order[i])?.title} · 已完成</span></div>)}</details>}
  <p className="license-local">每日 20 项 · 随机排序 · 逐项揭晓 · 进度仅保存在当前浏览器的本账号下</p>
 <JourneyEffects theme={premium?"premium":undefined} event={effect} onClose={closeEffect}/>
 </section>;
}
export default function LicensePreview(){
 const {ownerId}=useAccountJourney();
 const [replay,setReplay]=useState(false);
 const [day,setDay]=useState(()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date()));
 useEffect(()=>{const timer=setInterval(()=>setDay(new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date())),30000);return()=>clearInterval(timer);},[]);
 const key=`studio-license-reading-v1:${ownerId}:${day}`;
 return <ReadingSession key={key+(replay?':replay':'')} storageKey={key} day={day} replay={replay} onReplay={()=>setReplay(v=>!v)}/>;
}
