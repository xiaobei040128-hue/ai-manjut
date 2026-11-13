import {copyTaskCode} from './task-clipboard';
import {memo,useCallback,useEffect,useMemo,useRef,useState,type CSSProperties,type MouseEvent} from 'react';
import {createPortal} from 'react-dom';
import {api,type Assignment,type Bootstrap,type Task} from '../api';
import {BrandMark} from '../Brand';
import {coverImage} from '../cover-images';
import {translateText as tx} from '../i18n/translate';
import {useLanguage,getFormatLocale} from '../i18n/language';
import {navigateApp} from './app-navigation';
import {prepareTaskCover,taskCoverSource,knownTaskCover,forgetTaskCover,type TaskCoverPreview} from './task-cover-cache';
import {createTaskRowCache} from './task-view-state';
import TaskReveal from './TaskReveal';
import TaskMotion,{type MotionEvent} from './TaskMotion';
import {amountNumber} from './task-display';
import {playTaskCue,prepareTaskAudio,activateTaskAudio,suspendTaskAudio,taskSoundEnabled,setTaskSoundEnabled} from './task-audio';
import './task-experience.css';

type Snapshot=Pick<Bootstrap,'wallet'|'assignments'>&{coverPreview?:TaskCoverPreview;historyTotal?:number;ownerId:string;offer:{id:string;task:Task;reservedAmount:number|null}|null;dispatch:{dailyCompleted:number;dailyLimit:number;waiting:boolean;nextUnlockAt:string|null;timeZone:string;batch:number;planSequence:number|null}};
type HistoryPage={items:Assignment[];nextCursor:string|null;total:number};
type ArchiveState={records:Assignment[];loaded:boolean;cursor:string|null;loading:boolean;error:string;total:number};
const emptyArchive=():ArchiveState=>({records:[],loaded:false,cursor:null,loading:false,error:'',total:0});
type License={assignment:Assignment;code:string|null;first?:boolean;snapshot?:Snapshot};
const active=(a:Assignment)=>['active','review','revision'].includes(a.status);
const url=(id:string)=>'/?page=assignment&copyright=1&assignment='+encodeURIComponent(id);
const ordered=(s:Snapshot|null)=>(s?.assignments||[]).filter(a=>a.task.stage===3&&a.status==='completed').sort((a,b)=>(b.reviewed_at||b.created_at).localeCompare(a.reviewed_at||a.created_at)||b.id.localeCompare(a.id));
export function roundRecords(s:Snapshot|null){return ordered(s).slice(0,s?.dispatch.dailyCompleted||0).reverse();}
export function Artwork({task,className=''}:{task:Task;className?:string}){
 const source=taskCoverSource(task.cover);
 return <TaskArtwork key={source} task={task} className={className} source={source}/>;
}

function TaskArtwork({task,className,source}:{task:Task;className:string;source:string}){
 const [previewFailed,setPreviewFailed]=useState(false);
 const [failed,setFailed]=useState(false);
 const src=previewFailed?coverImage(task.cover,'thumbnail'):source;
 return <div className={className+(failed?' artwork-failed':'')}>
  <img key={src} src={src} alt={task.title} loading={className==='cover-frame'?'eager':'lazy'} decoding="async"
   onError={()=>{
    if(!previewFailed&&source.startsWith('data:')){
     forgetTaskCover(task.cover);
     setPreviewFailed(true);
    }else setFailed(true);
   }}/>
  {failed&&<span className="artwork-fallback" aria-hidden="true">{task.title}</span>}
 </div>;
}
const Collection=memo(function Collection({records,allRecords,selectedId,onSelect,onOpen,onOlder,historyTotal,hasOlder,historyLoading,historyError,dialogRef,onClose}:{records:Assignment[];allRecords:Assignment[];selectedId:string|null;onSelect:(id:string)=>void;onOpen:(id?:string)=>void;onOlder:()=>Promise<Assignment[]>;historyTotal:number;hasOlder:boolean;historyLoading:boolean;historyError:string;dialogRef:React.RefObject<HTMLDialogElement|null>;onClose:()=>void}){
 const sheet=useRef<HTMLDivElement>(null),pointer=useRef<{id:number;x:number;y:number}|null>(null),animation=useRef<Animation|null>(null),direction=useRef(1);
 const selectedIndex=selectedId?allRecords.findIndex(a=>a.id===selectedId):-1,selection=selectedIndex>=0?selectedIndex:Math.max(0,allRecords.length-1),item=allRecords[selection],offset=Math.max(0,historyTotal-allRecords.length),total=records.reduce((n,a)=>n+a.task.commission,0);
 const flip=(n:number)=>{if(historyLoading)return;direction.current=n<selection?-1:1;if(n<0&&hasOlder){void onOlder().then(items=>{if(items[0])onSelect(items[0].id);});return;}if(n<0||n>=allRecords.length){if(!matchMedia('(prefers-reduced-motion: reduce)').matches)sheet.current?.animate([{transform:'translateX(0)'},{transform:`translateX(${n<0?6:-6}px)`},{transform:'translateX(0)'}],{duration:180});return;}onSelect(allRecords[n].id);};
 useEffect(()=>{if(sheet.current&&dialogRef.current?.open){sheet.current.scrollTop=0;animation.current?.cancel();if(!matchMedia('(prefers-reduced-motion: reduce)').matches)animation.current=sheet.current.animate([{opacity:.3,transform:`translateX(${direction.current<0?-14:14}px)`},{opacity:1,transform:'translateX(0)'}],{duration:220,easing:'ease-out'});}return()=>animation.current?.cancel();},[item?.id]);
 return <><section className="collection" aria-label={tx('今日片单')}><header><h3>{tx('今日片单')} <span>{records.length.toString().padStart(2,'0')}</span></h3><button disabled={!historyTotal&&!allRecords.length} onClick={()=>onOpen()}>{tx('打开收藏册')} <span>↗</span></button></header><div className="collection-rail">{records.length?records.map((a,i)=><button key={a.id} type="button" className={'collection-item'+(a.task.premium?' premium-item':'')} data-tier={a.task.premium?'premium':'standard'} data-collection-id={a.id} aria-label={tx('查看记录')+' '+a.task.title} onClick={()=>onOpen(a.id)}><img src={taskCoverSource(a.task.cover)} alt={a.task.title} loading="lazy" decoding="async"/><span className="collection-number">{(i+1).toString().padStart(2,'0')}</span></button>):<div className="empty-collection"><span>＋</span><p>{tx('完成第一单')}<br/><small>{tx('点亮你的今日片单')}</small></p></div>}</div></section>
 {createPortal(<div className="task-experience task-experience-overlay"><dialog ref={dialogRef} className="archive-dialog" data-tier={item?.task.premium?'premium':'standard'} aria-labelledby="archiveHeading" onClose={onClose} onKeyDown={e=>{if(e.key==='ArrowLeft'){e.preventDefault();flip(selection-1);}if(e.key==='ArrowRight'){e.preventDefault();flip(selection+1);}}}>
 <header><div><small>YOUR COLLECTION</small><h2 id="archiveHeading">{tx('收藏册')}</h2></div><button aria-label={tx('关闭收藏册')} onClick={()=>dialogRef.current?.close()}>×</button></header>
 {item&&<div className="archive-sheet" role="region" aria-label={tx('作品详情')} tabIndex={0} ref={sheet} onPointerDown={e=>{if(e.pointerType==='mouse'&&e.button!==0)return;pointer.current={id:e.pointerId,x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerCancel={()=>pointer.current=null} onPointerUp={e=>{const p=pointer.current;pointer.current=null;if(!p||p.id!==e.pointerId)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.4)flip(selection+(dx<0?1:-1));}}>
 <div className="archive-artwork"><Artwork className="archive-mat" task={item.task}/><div className="archive-spine" aria-hidden="true">AI CREATOR — COLLECTED STORIES</div><span className="archive-edition">{item.task.premium?'PREMIUM COLLECTION':'STORY COLLECTION'}</span></div>
 <div className="archive-caption"><span>{tx('已完成')}</span><h3>{item.task.title}</h3><p>{tx(item.task.description)}</p></div><div className="archive-receipt"><div><small>{tx('本单到账佣金')}</small><strong>+{amountNumber(item.task.commission)}</strong></div><div><small>{tx('已返还版权金额')}</small><b>{amountNumber(item.task.deposit)}</b></div></div></div>}
 {historyLoading&&<p className="archive-feedback" role="status">{tx('正在加载…')}</p>}{historyError&&<div className="archive-feedback" role="alert"><span>{tx(historyError)}</span><button onClick={()=>void onOlder()}>{tx('重新连接')}</button></div>}
 <nav aria-label={tx('浏览已完成作品')}><button disabled={historyLoading||(selection<=0&&!hasOlder)} aria-label={tx('上一部作品')} onClick={()=>flip(selection-1)}>←</button><span role="status" aria-live="polite">{allRecords.length?offset+selection+1:0} / {historyTotal}</span><button disabled={historyLoading||selection>=allRecords.length-1} aria-label={tx('下一部作品')} onClick={()=>flip(selection+1)}>→</button></nav><footer><span>{tx('今日累计佣金')}</span><b>{amountNumber(total)}</b></footer>
 </dialog></div>,document.body)}</>;
});
export default function TaskExperience({assignmentId}:{assignmentId?:string}){
 useLanguage();
 const [soundEnabled,setSoundEnabled]=useState(taskSoundEnabled);
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[license,setLicense]=useState<License|null>(null),[error,setError]=useState(''),[networkError,setNetworkError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[manual,setManual]=useState(false),[motion,setMotion]=useState<MotionEvent|null>(null),[lastSettled,setLastSettled]=useState<Assignment|null>(null),[archiveSelection,setArchiveSelection]=useState<string|null>(null),[purchaseAttempt,setPurchaseAttempt]=useState(false);
 const [archiveState,setArchiveState]=useState<ArchiveState>(emptyArchive),archiveStateRef=useRef(archiveState),pendingHistory=useRef<Promise<Assignment[]>|null>(null);archiveStateRef.current=archiveState;
 useEffect(()=>{prepareTaskAudio();return suspendTaskAudio;},[]);
 const alive=useRef(true),lock=useRef(false),version=useRef(0),sound=useRef(()=>{}),root=useRef<HTMLDivElement>(null),primary=useRef<HTMLButtonElement>(null),archive=useRef<HTMLDialogElement>(null),licenseVersion=useRef(0),lastOwner=useRef('');
 const snapRef=useRef(snapshot);snapRef.current=snapshot;
 const pendingLoad=useRef<{ticket:number;request:Promise<Snapshot|null>}|null>(null),lastSnapshot=useRef('');
 const shareRows=useMemo(()=>createTaskRowCache<Assignment>(),[]);
 const apply=useCallback((next:Snapshot)=>{if(!alive.current)return;const {coverPreview,...view}=next,encoded=JSON.stringify(view);setNetworkError('');if(encoded===lastSnapshot.current)return;lastSnapshot.current=encoded;const shared={...view,assignments:shareRows(view.assignments)};if(snapRef.current&&(snapRef.current.ownerId!==shared.ownerId||snapRef.current.dispatch.batch!==shared.dispatch.batch)){setLastSettled(null);setMotion(null);}setSnapshot(shared);const owner=shared.ownerId;if(owner)try{const id=sessionStorage.getItem('task-last-settled:'+owner+':'+shared.dispatch.batch),a=shared.assignments.find(x=>x.id===id&&x.status==='completed'&&x.owner_id===owner);setLastSettled(a??null);}catch{}},[shareRows]);
 const load=useCallback(()=>{
  if(pendingLoad.current?.ticket===version.current)return pendingLoad.current.request;
  const ticket=++version.current;if(!snapRef.current)setLoading(true);
  const request=(async()=>{try{const current=snapRef.current,known=knownTaskCover(current?.offer?.task.cover||current?.assignments.find(active)?.task.cover),next=await api<Snapshot>('/stage-finance?view=task&roundOnly=1&preview=1&coverKnown='+encodeURIComponent(known)+(assignmentId?'&assignment='+encodeURIComponent(assignmentId):''));await prepareTaskCover(next.coverPreview);if(alive.current&&ticket===version.current){apply(next);return next;}}
  catch(e){if(alive.current&&ticket===version.current)setNetworkError((e as Error).message);}
  finally{if(pendingLoad.current?.ticket===ticket)pendingLoad.current=null;if(alive.current&&ticket===version.current)setLoading(false);}return null;})();pendingLoad.current={ticket,request};return request;
 },[apply,assignmentId]);
 useEffect(()=>{alive.current=true;void load();const refresh=()=>{if(document.hidden){sound.current();suspendTaskAudio();return;}if(!lock.current)void load();};const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);window.addEventListener('pageshow',refresh);document.addEventListener('visibilitychange',refresh);return()=>{alive.current=false;version.current++;licenseVersion.current++;sound.current();clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);window.removeEventListener('pageshow',refresh);document.removeEventListener('visibilitychange',refresh);};},[load]);
 const assignments=snapshot?.assignments.filter(a=>a.task.stage===3)||[],current=assignmentId?assignments.find(a=>a.id===assignmentId):assignments.find(active),selected=current||(!snapshot?.offer?lastSettled:null),offer=!assignmentId&&!current?snapshot?.offer:null,task=selected?.task||offer?.task;
 const state=selected?.status==='completed'?'settled':selected?.status==='cancelled'?'cancelled':selected?'purchased':offer?'offered':'ready';
 const records=useMemo(()=>roundRecords(snapshot),[snapshot?.assignments,snapshot?.dispatch.dailyCompleted]),allRecords=useMemo(()=>{const rows=new Map(archiveState.records.map(a=>[a.id,a]));for(const a of records)rows.set(a.id,a);return [...rows.values()].sort((a,b)=>(a.reviewed_at||a.created_at).localeCompare(b.reviewed_at||b.created_at)||a.id.localeCompare(b.id));},[archiveState.records,records]),historyTotal=Math.max(snapshot?.historyTotal??allRecords.length,archiveState.total),hasOlder=archiveState.loaded?archiveState.cursor!==null:historyTotal>allRecords.length,limit=snapshot?.dispatch.dailyLimit||50,completed=snapshot?.dispatch.dailyCompleted||0,total=records.reduce((n,a)=>n+a.task.commission,0),shownTotal=total,waiting=!!snapshot?.dispatch.waiting||completed>=limit;
 useEffect(()=>{if(!selected||state!=='purchased'){setLicense(null);return;}if(license?.assignment.id===selected.id&&license.code)return;const ticket=++licenseVersion.current;void api<License>('/stage-finance/license?assignment='+encodeURIComponent(selected.id)).then(next=>{if(alive.current&&ticket===licenseVersion.current&&next.assignment.id===selected.id){setLicense(next);setNetworkError('');}}).catch(e=>{if(alive.current&&ticket===licenseVersion.current)setNetworkError((e as Error).message);});return()=>{licenseVersion.current++;};},[selected?.id,state,!!license?.code]);
 useEffect(()=>{document.title=tx('今日任务')+' · AI CREATOR';},[]);
 useEffect(()=>{if(!snapshot)return;const owner=snapshot.ownerId;if(lastOwner.current&&owner&&lastOwner.current!==owner){setLastSettled(null);setMotion(null);setLicense(null);setArchiveState(emptyArchive());setArchiveSelection(null);pendingHistory.current=null;}if(owner)lastOwner.current=owner;},[snapshot]);
 function animate(task:Task,kind:MotionEvent['kind']){
  if(!document.hidden)setMotion({task,kind});
 }
 async function draw(){
  if(lock.current||waiting||assignmentId)return;lock.current=true;version.current++;setBusy(true);setError('');setPurchaseAttempt(false);activateTaskAudio();
  try{const next=await api<{offer:NonNullable<Snapshot['offer']>;snapshot:Snapshot}>('/stage-finance/draw','POST',{stage:3,includeSnapshot:true,taskView:true,roundOnly:true,coverPreview:true,coverKnown:knownTaskCover(task?.cover)});if(alive.current){void prepareTaskCover(next.snapshot.coverPreview);setLastSettled(null);try{const owner=next.snapshot.ownerId;if(owner)sessionStorage.removeItem('task-last-settled:'+owner+':'+next.snapshot.dispatch.batch);}catch{}setManual(false);apply(next.snapshot);sound.current();sound.current=playTaskCue(next.offer.task.premium?'premium':'standard');animate(next.offer.task,'reveal');}}
  catch(e){if(alive.current){setError((e as Error).message);const fresh=await load();if(fresh&&(fresh.offer||fresh.assignments.some(active)))setError('');}}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 async function purchase(){
  if(lock.current||!offer)return;lock.current=true;version.current++;setBusy(true);setError('');setPurchaseAttempt(true);
  try{const next=await api<{assignment:Assignment;license:License;snapshot:Snapshot}>('/stage-finance/accept','POST',{offerId:offer.id,taskView:true,roundOnly:true,expected:{amount:offer.task.deposit,commission:offer.task.commission,rateBps:offer.task.commission_rate_bps}});if(alive.current){setLicense(next.license);apply(next.snapshot);}}
  catch(e){if(alive.current){setError((e as Error).message);const fresh=await load();if(fresh?.assignments.some(a=>a.task.id===offer.task.id&&active(a)))setError('');}}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 async function complete(){
  if(lock.current||!selected||!license?.code||license.assignment.id!==selected.id)return;lock.current=true;version.current++;setBusy(true);setError('');activateTaskAudio();
  try{
   if(!manual)try{await copyTaskCode(license.code);}catch{if(alive.current){setManual(true);setError('自动复制未成功，请手动复制上方版权码，再点击下方按钮完成。');}return;}
   if(!alive.current)return;
   const result=await api<License>('/stage-finance/license/complete','POST',{assignmentId:selected.id,code:license.code,taskView:true,roundOnly:true});if(result.assignment.id!==selected.id)throw Error('任务记录不匹配，请刷新后重试。');
   if(alive.current){setLicense(result);setLastSettled(result.assignment);try{sessionStorage.setItem('task-last-settled:'+result.assignment.owner_id+':'+snapshot?.dispatch.batch,result.assignment.id);}catch{}setSnapshot(prev=>prev?{...prev,assignments:[result.assignment,...prev.assignments.filter(a=>a.id!==selected.id)]}:prev);setManual(false);const fresh=result.snapshot;if(fresh)apply(fresh);else await load();if(result.first){sound.current();sound.current=playTaskCue('complete');animate(result.assignment.task,'settled');}}
  }catch(e){if(alive.current){setError((e as Error).message);const fresh=await load();const recovered=fresh?.assignments.find(a=>a.id===selected.id&&a.status==='completed');if(recovered&&fresh){setError('');setLastSettled(recovered);try{sessionStorage.setItem('task-last-settled:'+fresh.ownerId+':'+fresh.dispatch.batch,recovered.id);}catch{}}}}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 const closeArchive=useCallback(()=>primary.current?.focus({preventScroll:true}),[]);
 const loadOlder=useCallback(()=>{
  if(pendingHistory.current)return pendingHistory.current;const state=archiveStateRef.current,owner=snapRef.current?.ownerId;if(!owner||(state.loaded&&!state.cursor))return Promise.resolve([] as Assignment[]);
  setArchiveState(prev=>({...prev,loading:true,error:''}));let request!:Promise<Assignment[]>;request=(async()=>{try{const page=await api<HistoryPage>('/stage-finance/history'+(state.loaded&&state.cursor?'?cursor='+encodeURIComponent(state.cursor):''));if(!alive.current||snapRef.current?.ownerId!==owner)return [];setArchiveState(prev=>{const rows=new Map(prev.records.map(a=>[a.id,a]));for(const a of page.items)rows.set(a.id,a);return {...prev,records:[...rows.values()],loaded:true,cursor:page.nextCursor,total:page.total,loading:false,error:''};});return page.items;}catch(e){if(alive.current&&snapRef.current?.ownerId===owner)setArchiveState(prev=>({...prev,loading:false,error:(e as Error).message}));return [];}finally{if(pendingHistory.current===request)pendingHistory.current=null;}})();pendingHistory.current=request;return request;
 },[]);
 const openArchive=useCallback((id?:string)=>{setArchiveSelection(id||null);archive.current?.showModal();if(!archiveStateRef.current.loaded)void loadOlder();},[loadOlder]);
 function next(){if(waiting){openArchive();return;}if(assignmentId){navigateApp('/?design=third');return;}void draw();}
 function action(event:MouseEvent<HTMLButtonElement>){if(event.detail>1)return;if(state==='offered')void purchase();else if(state==='purchased')void complete();else if(state==='settled'||state==='cancelled')next();else if(waiting)openArchive();else void draw();}
 const card=useRef<HTMLElement>(null);
 useEffect(()=>{
  const element=card.current;
  if(!motion||!element||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  if(motion.kind==='reveal')return;
  const frames=motion.kind==='settled'
   ?[{transform:'scale(1)'},{transform:'scale(1.012)',offset:.4},{transform:'scale(1)'}]
   :[{transform:'translateY(9px)',opacity:.88},{transform:'translateY(0) scale(1)',opacity:1}];
  const animation=element.animate(frames,{duration:260,easing:'cubic-bezier(.2,.8,.2,1)'});
  return()=>animation.cancel();
 },[motion]);
 const topup=task&&offer&&snapshot?Math.max(0,task.deposit-(snapshot.wallet.available+(offer.reservedAmount||0))):0;
 const label=busy?(state==='purchased'?'正在完成…':state==='offered'?'正在处理…':'正在开启…'):state==='offered'?'确认购买':state==='purchased'?(manual?'已手动复制，完成任务':'复制并完成任务'):state==='settled'||state==='cancelled'?(assignmentId?'返回今日任务':waiting?'查看今日片单':'领取下一单'):waiting?'查看今日片单':'领取任务';
 return <div className="studio native-mode task-experience"><div className="device-wrap"><div className="device" data-tier={task?.premium?'premium':'standard'} data-complete={waiting}>
 <div><header className="app-header"><a className="task-home" href="/?page=home" aria-label={tx('返回首页')}><span aria-hidden="true" style={{fontSize:24,lineHeight:1}}>←</span><BrandMark/></a><div><strong>{tx('今日任务')}</strong><small>AI CREATOR</small></div><button type="button" className="task-sound" aria-label={soundEnabled?'Mute task sounds':'Enable task sounds'} aria-pressed={soundEnabled} onClick={()=>{const next=!soundEnabled;setTaskSoundEnabled(next);setSoundEnabled(next);if(next)activateTaskAudio();}}>{soundEnabled?'♪':'♩'}</button><a className="task-wallet" href="/?page=wallet">{tx('钱包')} ↗</a></header>
 <main className="app-scroll" ref={root}>
 <section className="daily-summary" data-milestone={completed>0&&completed%5===0} aria-label={tx('今日完成进度')}><div className="daily-heading"><span>{tx('今日完成')}</span><span className="summary-currency">{tx('累计佣金')}</span></div><div className="daily-numbers"><span><strong>{snapshot?completed:'—'}</strong><em>/ {limit}</em></span><span className="earnings"><b>{snapshot?amountNumber(shownTotal):'—'}</b></span></div><div className="progress-track" role="progressbar" aria-label={tx('今日完成数量')} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={completed}><i style={{transform:'scaleX('+Math.min(1,completed/limit)+')'}}/></div></section>
 {waiting&&snapshot?.dispatch.nextUnlockAt&&<p className="task-next-unlock">{tx('下一计划日开放：')}{new Intl.DateTimeFormat(getFormatLocale(),{timeZone:snapshot.dispatch.timeZone,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(snapshot.dispatch.nextUnlockAt))} <small>{snapshot.dispatch.timeZone}</small></p>}
 {networkError&&<div className="task-network-error" role="alert"><p>{tx(networkError)}</p><button disabled={busy||loading} onClick={()=>void load()}>{tx('重新连接')}</button></div>}
 {assignmentId&&snapshot&&!selected?<p role="alert">{tx('版权任务不存在')}</p>:<>
 <section ref={card} data-task-card="" data-state={state} data-tier={task?.premium?'premium':'standard'} className={"work-card"+(state==='purchased'?' is-purchasing':state==='settled'?' is-settling':'')} aria-label={tx('当前任务')} aria-busy={busy}>
 {task?<div key={offer?.id??selected?.id} className="revealed-scene" data-task-arrival={state==='offered'?(task.premium?'premium':'standard'):undefined}><div className="card-status"><span>{tx(task.premium?'多集版权 · 高阶专属':'作品版权')}</span><span id="orderStatus">{tx(state==='settled'?'已完成':state==='cancelled'?'已取消':state==='purchased'?'已购买':'已领取')}</span></div><div className="work-intro"><Artwork className="cover-frame" task={task}/><div className="work-meta"><span className="fine-label">{tx(task.genre)}</span><h2 dir="auto">{task.title}</h2><p className="inline-synopsis">{tx(task.description)}</p></div><div className="money-panel"><div><span>{tx(state==='settled'||state==='cancelled'?'已返还金额':'版权金额')}</span><strong>{amountNumber(task.deposit)}</strong></div><div><span>{tx(state==='settled'?'已到账佣金':'完成佣金')}</span><strong>{amountNumber(state==='cancelled'?0:task.commission)}</strong></div></div></div>
 {state==='purchased'&&<div className="license-panel"><div><span>{tx('本单版权码')}</span><span className="code-state">{tx(license?.code?'已生成':'正在读取…')}</span></div><input className="task-license-code" aria-label={tx('作品版权码')} value={license?.assignment.id===selected?.id?license?.code||'':''} readOnly onFocus={e=>e.currentTarget.select()}/></div>}
 {state==='settled'&&<div className="settlement-banner"><span className="success-orb">✓</span><div><strong>{tx('本单已结算')}</strong></div></div>}
 </div>:<div className="idle-scene"><div className="archive-idle" aria-hidden="true"><div className="archive-floor"/><img src="/art/task-archive-case-runtime.webp" alt=""/><div className="archive-invite"><span>AI CREATOR</span><b>✦</b><small>YOUR NEXT STORY</small></div><img className="archive-front" src="/art/task-archive-case-runtime.webp" alt=""/></div><div className="idle-copy"><span className="fine-label">YOUR NEXT STORY</span><h2>{tx(loading&&!snapshot?'正在加载…':waiting?'今日任务已完成，明天继续':'准备好，开启下一单')}</h2></div></div>}
 </section>
 <div className="card-action" data-task-action="" data-state={state} data-tier={task?.premium?'premium':'standard'}>{error&&!(purchaseAttempt&&topup>0)&&<div className="error-notice" role="alert">{tx(error)}</div>}{purchaseAttempt&&topup>0&&<div className="task-topup" role="alert"><strong className="task-shortfall-title">{tx('余额不足')}</strong><p><span>{tx('还需补充')}</span><b>{amountNumber(topup)}</b></p><a href={'/?page=wallet&finance=deposit&returnDesign=third&amount='+(Math.max(100,topup)/100).toFixed(2)}>{tx('补齐差额')} · {amountNumber(Math.max(100,topup))} ↗</a></div>}<button className="primary-action" ref={primary} disabled={busy||!snapshot||!!networkError||(state==='purchased'&&!license?.code)||(!task&&waiting&&!allRecords.length)} onClick={action}><span className="button-label">{tx(label)}</span><span className="button-symbol" aria-hidden="true">{state==='purchased'?'✓':'↗'}</span></button></div>
 </>}
 <Collection records={records} allRecords={allRecords} selectedId={archiveSelection} onSelect={setArchiveSelection} onOpen={openArchive} onOlder={loadOlder} historyTotal={historyTotal} hasOlder={hasOlder} historyLoading={archiveState.loading} historyError={archiveState.error} dialogRef={archive} onClose={closeArchive}/>
 </main></div></div></div>
 {motion?.kind==='reveal'&&offer&&!matchMedia('(prefers-reduced-motion: reduce)').matches
  ? <TaskReveal key={offer.id} task={motion.task} sequence={completed+1} onClose={()=>setMotion(null)}/>
  : <TaskMotion event={motion} onClose={()=>setMotion(null)}/>}

 </div>;
}

