import {useCallback,useEffect,useRef,useState} from 'react';
import {api,money,statusText,type Task,type Assignment,type Bootstrap} from '../api';
import {MobileScroll} from '../mobile';
import EnrollmentCard from './EnrollmentCard';
import TaskCelebration from './TaskCelebration';
import './stage-work.css';
import {NewcomerProgress,type JourneySnapshot} from './NewcomerProgress';
import CommunityJourney from './CommunityJourney';
import PurchaseBalance from './PurchaseBalance';
import './purchase-page.css';
import JourneyEffects,{type JourneyEvent} from './JourneyEffects';
import {playWelcomeChime,unlockWelcomeAudio} from './welcome-audio';
import './license-gold.css';
import NewcomerCover from './NewcomerCover';

type Snapshot=Bootstrap&{
 journey:JourneySnapshot;
 offer:{id:string;stage:number;task:Task}|null;
 commissionPolicy:{rate_bps:number|null};
 dispatch:{day:string;claimed:number;limit:number};
 stageTwoEligible:boolean;
 stageThreeEligible:boolean;
};
type Award={id:string;title:string;amount:number;commission:number;kind:'reveal'|'settled'};
const assignmentUrl=(id:string)=>'/?view=app&page=assignment&assignment='+encodeURIComponent(id);
const live=(assignment:Assignment)=>['active','review','revision'].includes(assignment.status);

export default function StageWork({stage}:{stage:number}){
 const [data,setData]=useState<Snapshot|null>(null),[error,setError]=useState(''),[connectionError,setConnectionError]=useState(''),[loading,setLoading]=useState(false),[claiming,setClaiming]=useState(false),[award,setAward]=useState<Award|null>(null);
 const [revealEvent,setRevealEvent]=useState<JourneyEvent|null>(null);
 const closeReveal=useCallback(()=>setRevealEvent(null),[]);
 const stopStageAudio=useRef<()=>void>(()=>{});
 const mounted=useRef(true),readVersion=useRef(0),claimLock=useRef(false),seen=useRef(new Set<string>());

 const load=useCallback(async()=>{
  const version=++readVersion.current;setLoading(true);
  try{if(stage===1){const journey=await api<JourneySnapshot&{rewards:{amount:number}[]}>('/stage-journey/sync','POST',{});if(mounted.current&&version===readVersion.current&&journey.rewards?.length)setRevealEvent({kind:'reward',nonce:Date.now(),amount:money(journey.rewards.reduce((n,r)=>n+r.amount,0)),title:'成长奖励已到账',subtitle:'恭喜，离你的下一章更近了一步。'});}const snapshot=await api<Snapshot>('/stage-finance');if(mounted.current&&version===readVersion.current){setData(snapshot);setConnectionError('');}return snapshot;
  }catch(e){if(mounted.current&&version===readVersion.current)setConnectionError((e as Error).message);return null;
  }finally{if(mounted.current&&version===readVersion.current)setLoading(false);}
 },[stage]);

 useEffect(()=>{
  mounted.current=true;void load();
  const refresh=()=>{if(document.visibilityState==='visible'&&!claimLock.current)void load();};
  const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);
  return()=>{mounted.current=false;readVersion.current++;stopStageAudio.current();clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[load]);

 useEffect(()=>{
  if(!data||award)return;
  const completed=data.assignments.find(a=>{
   if(a.status!=='completed'||!a.task.premium||a.task.stage!==stage||seen.current.has(a.id))return false;
   try{return !localStorage.getItem('studio-settlement-seen:'+a.owner_id+':'+a.id);}catch{return true;}
  });
  if(completed)setAward({id:completed.id,title:completed.task.title,amount:completed.task.deposit,commission:completed.task.commission,kind:'settled'});
 },[data,stage,award]);

 async function takeNewcomer(){
  if(claimLock.current)return;claimLock.current=true;readVersion.current++;setClaiming(true);setError('');void unlockWelcomeAudio();
  try{const result=await api<JourneySnapshot&{offer?:Snapshot['offer']}>('/stage-journey/take','POST',{});await load();if(mounted.current){setRevealEvent({kind:'task',nonce:Date.now(),title:result.cover?'你的版权封面已揭晓':'新的任务已开启',subtitle:result.cover?.artwork.title||'属于你的下一步，从这里开始。'});stopStageAudio.current();stopStageAudio.current=playWelcomeChime(0);}}
  catch(e){if(mounted.current)setError((e as Error).message);}finally{claimLock.current=false;if(mounted.current)setClaiming(false);}
 }
 async function draw(){
  if(claimLock.current)return;void unlockWelcomeAudio();claimLock.current=true;readVersion.current++;setClaiming(true);setError('');
  try{const offer=await api<NonNullable<Snapshot['offer']>>('/stage-finance/draw','POST',{stage});if(mounted.current){setData(previous=>previous?{...previous,offer}:previous);setRevealEvent({kind:'task',nonce:Date.now(),title:'这一单，正式揭晓',subtitle:offer.task.title});stopStageAudio.current();stopStageAudio.current=playWelcomeChime(0);}}
  catch(e){if(mounted.current)setError((e as Error).message);}
  finally{claimLock.current=false;if(mounted.current)setClaiming(false);}
 }
 async function claim(task:Task){
  if(claimLock.current)return;
  claimLock.current=true;setClaiming(true);setError('');
  try{
   const a=await api<Assignment>('/stage-finance/accept','POST',{offerId:data?.offer?.id,expected:{amount:task.deposit,commission:task.commission,rateBps:task.commission_rate_bps}});
   if(!mounted.current)return;
   if(a.task.premium)setAward({id:a.id,title:a.task.title,amount:a.task.deposit,commission:a.task.commission,kind:'reveal'});
   else location.assign(assignmentUrl(a.id));
  }catch(e){await load();if(mounted.current)setError((e as Error).message);
  }finally{claimLock.current=false;if(mounted.current)setClaiming(false);}
 }

 function closeAward(){
  if(!award)return;
  if(award.kind==='settled'){
   seen.current.add(award.id);
   const owner=data?.assignments.find(a=>a.id===award.id)?.owner_id;
   if(owner)try{localStorage.setItem('studio-settlement-seen:'+owner+':'+award.id,'1');}catch{/* Receipt remains correct even if browser storage is unavailable. */}
  }
  location.assign(assignmentUrl(award.id));
 }

 const ready=data?.commissionPolicy.rate_bps!=null;
 const eligible=stage===1||stage===2&&data?.stageTwoEligible||stage===3&&data?.stageThreeEligible;
 const assignments=data?.assignments.filter(a=>a.task.stage===stage)||[];
 const current=assignments.find(live),offer=data?.offer?.stage===stage?data.offer:null,task=offer?.task;
 const blockedByCurrent=!!data?.assignments.some(live),blockedByOffer=!!data?.offer&&!offer;
 const dailyLimitReached=stage===3&&!!data&&data.dispatch.claimed>=data.dispatch.limit;

 useEffect(()=>{
  if(stage!==1||!data?.journey.newcomer.card)return;
  const query=new URLSearchParams(location.search);
  if(query.get('binding')==='completed'){
   query.delete('binding');history.replaceState(null,'','/?'+query.toString());
   void api<{show:boolean}>('/stage-journey/binding-completion','POST',{}).then(result=>{if(mounted.current&&result.show)setRevealEvent({kind:'complete',nonce:Date.now(),title:'绑定任务已完成',subtitle:'提款方式已保存。准备好后，领取下一份任务。'});}).catch(()=>{});
  }
 },[stage,data?.journey.newcomer.card]);
 const withdrawalState=data?.journey.pendingWithdrawal?.status;
 const priorWithdrawal=useRef<string|undefined>(undefined);
 useEffect(()=>{
  if(stage!==1||!data)return;
  if(priorWithdrawal.current&&data.journey.newcomer.withdrawal&&!data.journey.pendingWithdrawal)setRevealEvent({kind:'complete',nonce:Date.now(),title:'提款任务已完成',subtitle:'款项已出，新手成长计划已完成。'});
  priorWithdrawal.current=withdrawalState;
  const query=new URLSearchParams(location.search);if(query.has('withdrawal')){query.delete('withdrawal');history.replaceState(null,'','/?'+query.toString());}
 },[stage,withdrawalState,data?.journey.newcomer.withdrawal]);
 const availableStage=data?(data.stageThreeEligible||data.journey.community.completed===5||data.assignments.some(a=>a.status==='completed'&&a.task.stage===2)?3:data.journey.newcomer.complete?2:1):1;
 useEffect(()=>{if(data&&stage>availableStage)location.replace('/?view=app&design='+['newcomer','advanced','third'][availableStage-1]);},[data,stage,availableStage]);
 if(stage>1&&(!data||stage>availableStage))return <div className="studio native-mode stage-work"><p role="status">正在加载你的计划…</p>{connectionError&&<p role="alert">{connectionError}</p>}</div>;
 if(stage===2)return <CommunityJourney available={connectionError?null:data?.wallet.available??null} onWalletChange={load}/>;
 return <div className={'studio native-mode stage-work'+(stage===1?' newcomer-current-page':stage===3?' purchase-page':'')}>
  <JourneyEffects event={revealEvent} onClose={closeReveal}/>
  <TaskCelebration award={award} onClose={closeAward}/>
  <header><a href="/?view=app">‹ 返回首页</a><h1>{stage===1?'新手成长计划':'作品探索'}</h1><button disabled={loading} onClick={()=>void load()}>{loading?'读取中…':'刷新'}</button></header>
  <MobileScroll className="stage-work-scroll"><main>
   {error&&<p role="alert">{error}</p>}
   {connectionError&&<div role="alert" className="stage-connection-error"><p>{connectionError}{data?'，当前显示上次读取的记录。':''}</p><button disabled={loading} onClick={()=>void load()}>重新连接</button></div>}
   {!data&&!connectionError&&<p role="status">正在加载…</p>}
   {stage===1&&<NewcomerProgress data={data?.journey||null} onTake={()=>void takeNewcomer()} busy={claiming} experienceCommission={assignments.filter(a=>a.status==='completed').reduce((n,a)=>n+a.task.commission,0)+(data?.journey.cover?.state==='completed'?(data.journey.cover.commission||0):0)}/>}
   {stage===1&&data?.journey.onboarding.step===2&&data.journey.onboarding.revealed&&!current&&<NewcomerCover data={data.journey} onUpdate={next=>{setData(previous=>previous?{...previous,journey:next}:previous);void load();}} onComplete={commission=>{setRevealEvent({kind:'reward',nonce:Date.now(),amount:money(commission),title:'封面任务已完成',subtitle:'版权码已核验，佣金已到账。'});stopStageAudio.current();stopStageAudio.current=playWelcomeChime(0);}}/>}
   {stage===3&&<section className="purchase-page-intro"><div><small>第三阶段 · 作品探索</small><h2>发现下一部好作品</h2></div><a href="/?view=app&page=wallet">我的钱包 →</a></section>}
   {data&&<>

    {!ready?<section><h2>任务暂未开放</h2><p>平台正在配置佣金规则，请稍后刷新。</p></section>:<>
     {!eligible&&stage===3&&<EnrollmentCard/>}
     {stage===3&&<div className="stage-daily-count"><span>{data.dispatch.day} · 北京时间</span><b>今日进度 {data.dispatch.claimed} / {data.dispatch.limit}</b>{dailyLimitReached&&<small>今日名额已用完，未完成任务仍可继续。</small>}</div>}
     {(stage!==1||!!current&&data.journey.onboarding.step===2&&data.journey.onboarding.revealed)&&<section id="experience-task" className="stage-task-list"><h2>{current?'进行中的作品':offer?'本次作品':'开启你的下一段故事'}</h2>
      {current?<article className="stage-task-card"><img src={current.task.cover} alt=""/><div><h3>{current.task.title}</h3><p>{statusText[current.status]}</p><button onClick={()=>location.assign(assignmentUrl(current.id))}>继续当前任务</button></div></article>
      :task?<article className="stage-task-card stage-story-card"><div className="stage-story-poster"><img src={task.cover} alt={task.title+'封面'}/><span>{task.genre} · {task.language}</span></div><div className="stage-story-copy">
       <small className="stage-story-eyebrow">{stage===3?'本次领取 · 作品版权':'YOUR NEXT STORY'}</small><h3>{task.title}</h3>
       <div className="stage-story-specs">{stage===3?<span>{task.genre}</span>:<><span>{task.episodes} 集</span><span>{task.platform}</span><span>{task.language}</span></>}</div>
       <h4>剧情概览</h4><p>{task.description}</p>
       {stage!==3&&<><h4>本次任务</h4><p>使用本次作品素材，在 {task.platform} 完成 {task.posts} 条作品发布，并提交发布链接与截图。</p></>}
       </div><div className="stage-story-checkout"><div className="stage-purchase-summary"><div><span>{stage===3?'版权选购金额':'任务金额'}</span><b>{money(task.deposit)}</b></div><div><span>预计收入</span><b>{money(task.commission)}</b></div></div>
       {stage===3&&<PurchaseBalance amount={task.deposit} available={connectionError?null:data.wallet.available} returnDesign="third"/>}<button hidden={stage===3&&data.wallet.available<task.deposit} disabled={claiming||!eligible||dailyLimitReached||data.wallet.available<task.deposit||!task.active||task.remaining<1||!!connectionError} onClick={()=>void claim(task)}>{claiming?'正在处理…':stage===3?'购买版权 · '+money(task.deposit):'接受任务 · '+money(task.deposit)}</button>
       {stage!==3&&data.wallet.available<task.deposit&&<a href="/?view=app&page=wallet">余额不足，前往充值 →</a>}
       <a href={'/?view=app&page=detail&task='+encodeURIComponent(task.id)}>查看素材与任务详情 →</a>
      </div></article>
      :<div className="stage-sealed-invitation"><div className="journey-invitation-art"><div className="journey-invitation-orbit"/><img src="/art/task-invitation-v1.png" alt="未揭晓的任务邀请"/></div><h3>好故事，即将与你相遇</h3>
       <button disabled={claiming||!eligible||dailyLimitReached||blockedByCurrent||blockedByOffer||!!connectionError} onClick={()=>void draw()}>{claiming?'正在开启…':'领取任务'}</button>
       {blockedByCurrent&&<p>请先完成并通过审核已接受的任务。</p>}{blockedByOffer&&<p>请先接受其他阶段已领取的任务。</p>}
      </div>}
     </section>}
    </>}
    {stage!==1&&assignments.length>0&&<section><h2>我的阶段记录</h2>{assignments.map(a=><article key={a.id}><div><h3>{a.task.title}</h3><p>{statusText[a.status]} · 本金 {money(a.task.deposit)} · 佣金 {money(a.task.commission)}</p><a href={assignmentUrl(a.id)}>查看进度与提交作品 →</a></div></article>)}</section>}
   </>}
  </main></MobileScroll>
 </div>;
}
