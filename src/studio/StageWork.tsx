import {translateText as tx,localizeNode as lx} from "../i18n/translate";
import {stageName} from './stage-copy';
import {navigateApp} from './app-navigation';
import {ThirdOverview,ThirdRecords} from './ThirdOverview';
import IdentityReward from './IdentityReward';
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
 offer:{id:string;stage:number;task:Task;reservedAmount:number|null}|null;
 commissionPolicy:{rate_bps:number|null};
 dispatch:{timeZone:string;nextUnlockAt:string|null;dailyClaimed:number;dailyCompleted:number;dailyLimit:number;day:string;today:string;batch:number;days:number;total:number;totalCompleted:number;completed:number;claimed:number;limit:number;quotas:number[];waiting:boolean;complete:boolean};
 stageTwoEligible:boolean;
 stageThreeEligible:boolean;
};
type Award={id:string;title:string;amount:number;commission:number;kind:'reveal'|'settled';cover?:string};
const assignmentUrl=(id:string)=>'/?view=app&page=assignment&copyright=1&assignment='+encodeURIComponent(id);
const live=(assignment:Assignment)=>['active','review','revision'].includes(assignment.status);

export default function StageWork({stage}:{stage:number}){
 useEffect(()=>{document.title=tx(stageName(stage))+" · AI CREATOR";});
 const [data,setData]=useState<Snapshot|null>(null),[error,setError]=useState(''),[connectionError,setConnectionError]=useState(''),[loading,setLoading]=useState(false),[claiming,setClaiming]=useState(false),[award,setAward]=useState<Award|null>(null);
 const [purchaseAttempt,setPurchaseAttempt]=useState<string|null>(null);
 const [revealEvent,setRevealEvent]=useState<JourneyEvent|null>(null);
 const closeReveal=useCallback(()=>setRevealEvent(null),[]);
 const stopStageAudio=useRef<()=>void>(()=>{});
 const mounted=useRef(true),readVersion=useRef(0),claimLock=useRef(false),seen=useRef(new Set<string>());

 const load=useCallback(async()=>{
  const version=++readVersion.current;setLoading(true);
  try{if(stage===1){const journey=await api<JourneySnapshot&{rewards:{id:string;amount:number}[]}>('/stage-journey/sync','POST',{});if(mounted.current&&version===readVersion.current&&journey.rewards?.filter(r=>!r.id.startsWith('newcomer-identity:')).length)setRevealEvent({kind:'reward',nonce:Date.now(),amount:money(journey.rewards.filter(r=>!r.id.startsWith('newcomer-identity:')).reduce((n,r)=>n+r.amount,0)),title:'成长奖励已到账',subtitle:'恭喜，离你的下一章更近了一步。'});}if(stage===3)await api('/stage-finance/reserve','POST',{});const snapshot=await api<Snapshot>('/stage-finance');if(mounted.current&&version===readVersion.current){setData(snapshot);setConnectionError('');}return snapshot;
  }catch(e){if(mounted.current&&version===readVersion.current)setConnectionError((e as Error).message);return null;
  }finally{if(mounted.current&&version===readVersion.current)setLoading(false);}
 },[stage]);

 useEffect(()=>{
  mounted.current=true;void load();
  const refresh=()=>{if(document.visibilityState==='visible'&&!claimLock.current)void load();};
  const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);
  return()=>{mounted.current=false;readVersion.current++;stopStageAudio.current();clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[load]);

 // Settlement celebrations belong to the exact completion response, never historical polling.

 async function takeNewcomer(){
  if(claimLock.current)return;claimLock.current=true;readVersion.current++;setClaiming(true);setError('');void unlockWelcomeAudio();
  try{const result=await api<JourneySnapshot&{offer?:Snapshot['offer']}>('/stage-journey/take','POST',{});await load();if(mounted.current){setRevealEvent({kind:'task',nonce:Date.now(),title:result.onboarding.step===2&&result.cover?.state==='offered'?'你的版权封面已揭晓':'新的任务已开启',subtitle:result.onboarding.step===2&&result.cover?.state==='offered'?result.cover.artwork.title:'属于你的下一步，从这里开始。'});stopStageAudio.current();stopStageAudio.current=playWelcomeChime(0);}}
  catch(e){if(mounted.current)setError((e as Error).message);}finally{claimLock.current=false;if(mounted.current)setClaiming(false);}
 }
 async function draw(){
  if(claimLock.current)return;void unlockWelcomeAudio();claimLock.current=true;readVersion.current++;setClaiming(true);setError('');
  try{const offer=await api<NonNullable<Snapshot['offer']>>('/stage-finance/draw','POST',{stage});if(mounted.current){await load();if(stage===3&&offer.task.premium)setAward({id:offer.id,title:offer.task.title,amount:offer.task.deposit,commission:offer.task.commission,cover:offer.task.cover,kind:'reveal'});else setRevealEvent({kind:'task',nonce:Date.now(),title:'这一单，正式揭晓',subtitle:offer.task.title});stopStageAudio.current();stopStageAudio.current=playWelcomeChime(0);}}
  catch(e){if(mounted.current)setError((e as Error).message);}
  finally{claimLock.current=false;if(mounted.current)setClaiming(false);}
 }
 async function claim(task:Task){
  if(claimLock.current)return;
  claimLock.current=true;setClaiming(true);setError('');if(stage===3)setPurchaseAttempt(data?.offer?.id||null);
  try{
   const a=await api<Assignment>('/stage-finance/accept','POST',{offerId:data?.offer?.id,expected:{amount:task.deposit,commission:task.commission,rateBps:task.commission_rate_bps}});
   if(!mounted.current)return;
   if(stage!==3&&a.task.premium)setAward({id:a.id,title:a.task.title,amount:a.task.deposit,commission:a.task.commission,kind:'reveal'});
   else navigateApp(assignmentUrl(a.id));
  }catch(e){await load();if(mounted.current)setError(stage===3&&(e as Error).message.includes('余额不足')?'':(e as Error).message);
  }finally{claimLock.current=false;if(mounted.current)setClaiming(false);}
 }

 async function discardOffer(){
  if(claimLock.current||!data?.offer)return;claimLock.current=true;readVersion.current++;setClaiming(true);setError('');
  try{await api('/stage-finance/discard','POST',{offerId:data.offer.id});await load();}
  catch(e){if(mounted.current)setError((e as Error).message);}finally{claimLock.current=false;if(mounted.current)setClaiming(false);}
 }

 function closeAward(){
  if(!award)return;
  if(stage===3&&award.kind==='reveal'){setAward(null);return;}
  if(award.kind==='settled'){
   seen.current.add(award.id);
   const owner=data?.assignments.find(a=>a.id===award.id)?.owner_id;
   if(owner)try{localStorage.setItem('studio-settlement-seen:'+owner+':'+award.id,'1');}catch{/* Receipt remains correct even if browser storage is unavailable. */}
  }
  navigateApp(assignmentUrl(award.id));
 }

 const ready=data?.commissionPolicy.rate_bps!=null;
 const eligible=stage===1||stage===2&&data?.stageTwoEligible||stage===3&&data?.stageThreeEligible;
 const assignments=data?.assignments.filter(a=>a.task.stage===stage)||[];
 const current=assignments.find(live),offer=data?.offer?.stage===stage?data.offer:null,task=offer?.task;
 const blockedByCurrent=!!data?.assignments.some(live),blockedByOffer=!!data?.offer&&!offer;
 const dailyLimitReached=stage===3&&!!data&&(data.dispatch.waiting||data.dispatch.complete||data.dispatch.claimed>=data.dispatch.limit||data.dispatch.dailyClaimed>=data.dispatch.dailyLimit);

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
  if(priorWithdrawal.current&&data.journey.newcomer.withdrawal&&!data.journey.pendingWithdrawal)setRevealEvent({kind:'complete',nonce:Date.now(),title:'提款任务已完成',subtitle:'款项已出，创作启航已完成。'});
  priorWithdrawal.current=withdrawalState;
  const query=new URLSearchParams(location.search);if(query.has('withdrawal')){query.delete('withdrawal');history.replaceState(null,'','/?'+query.toString());}
 },[stage,withdrawalState,data?.journey.newcomer.withdrawal]);
 const availableStage=data?(data.stageThreeEligible||data.journey.community.completed===5||data.assignments.some(a=>a.status==='completed'&&a.task.stage===2)?3:data.journey.newcomer.complete?2:1):1;
 useEffect(()=>{if(data&&stage>availableStage)navigateApp('/?view=app&design='+['newcomer','advanced','third'][availableStage-1],true);},[data,stage,availableStage]);
 if(stage>1&&(!data||stage>availableStage))return <div className="studio native-mode stage-work"><p role="status">{tx("正在加载你的计划…")}</p>{lx(connectionError&&<p role="alert">{lx(connectionError)}</p>)}</div>;
 if(stage===2)return <CommunityJourney onWalletChange={load}/>;
 return <div className={'studio native-mode stage-work'+(stage===1?' newcomer-current-page':stage===3?' purchase-page third-experience':'')}>
  {lx(stage===1&&<IdentityReward/>)}
  <JourneyEffects event={revealEvent} onClose={closeReveal}/>
  <TaskCelebration copyright={stage===3} award={award} onClose={closeAward}/>
  <header><a href="/?view=app">{tx("‹ 返回首页")}</a><h1>{lx(stageName(stage))}</h1><button disabled={loading} onClick={()=>void load()}>{lx(loading?'读取中…':'刷新')}</button></header>
  <MobileScroll className="stage-work-scroll"><main>
   {lx(error&&<p role="alert">{lx(error)}</p>)}
   {lx(connectionError&&<div role="alert" className="stage-connection-error"><p>{lx(connectionError)}{lx(data?'，当前显示上次读取的记录。':'')}</p><button disabled={loading} onClick={()=>void load()}>{tx("重新连接")}</button></div>)}
   {lx(!data&&!connectionError&&<p role="status">{tx("正在加载…")}</p>)}
   {lx(stage===1&&<NewcomerProgress data={data?.journey||null} onTake={()=>void takeNewcomer()} busy={claiming} experienceCommission={assignments.filter(a=>a.status==='completed').reduce((n,a)=>n+a.task.commission,0)+(data?.journey.cover?.state==='completed'?(data.journey.cover.commission||0):0)}/>)}
   {lx(stage===1&&data?.journey.onboarding.step===2&&data.journey.onboarding.revealed&&!current&&<NewcomerCover data={data.journey} onUpdate={next=>{setData(previous=>previous?{...previous,journey:next}:previous);void load();}} onComplete={commission=>{setRevealEvent({kind:'reward',nonce:Date.now(),amount:money(commission),title:'封面任务已完成',subtitle:'版权码已核验，佣金已到账。'});stopStageAudio.current();stopStageAudio.current=playWelcomeChime(0);}}/>)}

   {lx(data&&<>

    {lx(ready&&<>
     {lx(!eligible&&stage===3&&<EnrollmentCard/>)}
     {lx(stage===3&&<ThirdOverview claimed={data.dispatch.dailyClaimed+(offer?1:0)} completed={data.dispatch.dailyCompleted} limit={data.dispatch.dailyLimit} waiting={dailyLimitReached&&!current&&!offer} complete={data.dispatch.complete} timeZone={data.dispatch.timeZone} nextUnlockAt={data.dispatch.nextUnlockAt}/>)}

     {lx((stage!==1||!!current&&data.journey.onboarding.step===2&&data.journey.onboarding.revealed)&&!(stage===3&&dailyLimitReached&&!current&&!offer)&&<section id="experience-task" className="stage-task-list"><h2>{lx(current?'进行中的作品':offer?'本次作品':'开启你的下一段故事')}</h2>
      {lx(current?<article className={"stage-task-card"+(current.task.premium?" premium-license-card":"")}><img src={current.task.cover} alt=""/><div><h3>{lx(current.task.title)}</h3>{lx(!!current.task.premium&&<span className="premium-license-badge">{tx("高阶任务 · 全集版权")}</span>)}<p>{lx(statusText[current.status])}</p><button onClick={()=>navigateApp(assignmentUrl(current.id))}>{tx("继续当前任务")}</button></div></article>
      :task?<article className={"stage-task-card stage-story-card"+(task.premium?" premium-license-card":"")}><div className="stage-story-poster"><img src={task.cover} alt={tx(task.title+'封面')}/><span>{lx(task.genre)} · {lx(task.language)}</span></div><div className="stage-story-copy">
       <small className="stage-story-eyebrow">{lx(stage===3?(task.premium?'高阶任务 · 全集版权':'本次领取 · 作品版权'):'YOUR NEXT STORY')}</small><h3>{lx(task.title)}</h3>
       <div className="stage-story-specs">{lx(stage===3?<><span>{lx(task.genre)}</span>{lx(!!task.premium&&<span className="premium-license-badge">{tx("全集版权 · 高阶专属")}</span>)}</>:<><span>{lx(task.episodes)}{tx(" 集")}</span><span>{lx(task.platform)}</span><span>{lx(task.language)}</span></>)}</div>
       <h4>{tx("剧情概览")}</h4><p>{lx(task.description)}</p>
       {lx(stage!==3&&<><h4>{tx("本次任务")}</h4><p>{tx("使用本次作品素材，在 ")}{lx(task.platform)}{tx(" 完成 ")}{lx(task.posts)}{tx(" 条作品发布，并提交发布链接与截图。")}</p></>)}
       </div><div className="stage-story-checkout"><div className="stage-purchase-summary"><div><span>{lx(stage===3?'版权金额':'任务金额')}</span><b>{lx(money(task.deposit))}</b></div><div><span>{tx("预计收益")}</span><b>{lx(money(task.commission))}</b></div></div>
       {lx(stage===3&&purchaseAttempt===offer?.id&&data.wallet.available+(offer?.reservedAmount??0)<task.deposit&&<PurchaseBalance amount={task.deposit} available={connectionError?null:data.wallet.available} reservedAmount={offer?.reservedAmount??null} returnDesign="third"/>)}<button disabled={claiming||!eligible||dailyLimitReached||stage!==3&&data.wallet.available<task.deposit||!task.active||!!connectionError} onClick={()=>void claim(task)}>{lx(claiming?'正在处理…':stage===3?'确认购买':'接受任务 · '+money(task.deposit))}</button>
       {lx(stage!==3&&data.wallet.available+(stage===3?(offer?.reservedAmount??0):0)<task.deposit&&<a href="/?view=app&page=wallet">{tx("余额不足，前往充值 →")}</a>)}
       {lx(stage!==3&&<a href={'/?view=app&page=detail&task='+encodeURIComponent(task.id)}>{tx("查看素材与任务详情 →")}</a>)}
      </div></article>
      :<div className="stage-sealed-invitation"><span className="third-invitation-label">{tx("YOUR NEXT STORY · 作品邀请")}</span><div className="journey-invitation-art"><div className="journey-invitation-orbit"/><img src="/art/task-invitation-v1.png" alt={tx("未揭晓的任务邀请")}/></div><h3>{lx(data.dispatch.complete?'这一季的故事，已全部完成':dailyLimitReached?'今日任务已完成，明天继续':data.dispatch.dailyClaimed>0?'下一段故事，等待揭晓':'今日故事，待你揭晓')}</h3>
       <button disabled={claiming||!eligible||dailyLimitReached||blockedByCurrent||blockedByOffer||!!connectionError} onClick={()=>void draw()}>{lx(claiming?'正在开启…':data.dispatch.complete?'计划已完成':dailyLimitReached?'明天再来':data.dispatch.dailyClaimed>0?'领取下一项任务':'开启今日任务')}<span aria-hidden="true"> →</span></button>
       {lx(blockedByCurrent&&<p>{lx(stage===3?'请先完成当前版权任务。':'请先完成并通过审核已接受的任务。')}</p>)}{lx(blockedByOffer&&<p>{tx("请先接受其他阶段已领取的任务。")}</p>)}
      </div>)}
     </section>)}
    </>)}
    {lx(stage===3&&<ThirdRecords records={assignments}/>)}
    {lx(stage!==1&&stage!==3&&assignments.length>0&&<section><h2>{tx("我的阶段记录")}</h2>{lx(assignments.map(a=><article key={a.id}><div><h3>{lx(a.task.title)}</h3><p>{lx(statusText[a.status])}{tx(" · 本金 ")}{lx(money(a.task.deposit))}{tx(" · 佣金 ")}{lx(money(a.task.commission))}</p><a href={assignmentUrl(a.id)}>{lx(stage===3?'查看版权任务记录 →':'查看进度与提交作品 →')}</a></div></article>))}</section>)}
   </>)}
  </main></MobileScroll>
 </div>;
}
