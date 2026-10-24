import {useCallback,useEffect,useRef,useState} from 'react';
import {api,money,statusText,type Task,type Assignment,type Bootstrap} from '../api';
import {MobileScroll} from '../mobile';
import EnrollmentCard from './EnrollmentCard';
import TaskCelebration from './TaskCelebration';
import './stage-work.css';

type Snapshot=Bootstrap&{
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
 const mounted=useRef(true),readVersion=useRef(0),claimLock=useRef(false),seen=useRef(new Set<string>());

 const load=useCallback(async()=>{
  const version=++readVersion.current;setLoading(true);
  try{const snapshot=await api<Snapshot>('/stage-finance');if(mounted.current&&version===readVersion.current){setData(snapshot);setConnectionError('');}return snapshot;
  }catch(e){if(mounted.current&&version===readVersion.current)setConnectionError((e as Error).message);return null;
  }finally{if(mounted.current&&version===readVersion.current)setLoading(false);}
 },[]);

 useEffect(()=>{
  mounted.current=true;void load();
  const refresh=()=>{if(document.visibilityState==='visible'&&!claimLock.current)void load();};
  const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);
  return()=>{mounted.current=false;readVersion.current++;clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[load]);

 useEffect(()=>{
  if(!data||award)return;
  const completed=data.assignments.find(a=>{
   if(a.status!=='completed'||!a.task.premium||a.task.stage!==stage||seen.current.has(a.id))return false;
   try{return !localStorage.getItem('studio-settlement-seen:'+a.owner_id+':'+a.id);}catch{return true;}
  });
  if(completed)setAward({id:completed.id,title:completed.task.title,amount:completed.task.deposit,commission:completed.task.commission,kind:'settled'});
 },[data,stage,award]);

 async function claim(task:Task){
  if(claimLock.current)return;
  claimLock.current=true;setClaiming(true);setError('');
  try{
   const a=await api<Assignment>('/assignments','POST',{taskId:task.id,expected:{amount:task.deposit,commission:task.commission,rateBps:task.commission_rate_bps}});
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
 const tasks=data?.tasks.filter(t=>t.stage===stage)||[],assignments=data?.assignments.filter(a=>a.task.stage===stage)||[];
 const dailyLimitReached=stage===3&&!!data&&data.dispatch.claimed>=data.dispatch.limit;

 return <div className="studio native-mode stage-work">
  <TaskCelebration award={award} onClose={closeAward}/>
  <header><a href="/?view=app">‹ 返回首页</a><h1>第 {stage} 阶段任务</h1><button disabled={loading} onClick={()=>void load()}>{loading?'读取中…':'刷新'}</button></header>
  <MobileScroll className="stage-work-scroll"><main>
   <nav aria-label="阶段导航">{[1,2,3].map(n=><a key={n} aria-current={stage===n?'page':undefined} href={'/?view=app&design='+['newcomer','advanced','third'][n-1]}>第 {n} 阶段</a>)}</nav>
   {error&&<p role="alert">{error}</p>}
   {connectionError&&<div role="alert" className="stage-connection-error"><p>{connectionError}{data?'，当前显示上次读取的记录。':''}</p><button disabled={loading} onClick={()=>void load()}>重新连接</button></div>}
   {!data&&!connectionError&&<p role="status">正在读取金额与任务…</p>}
   {data&&<>
    <section><h2>账户资金</h2><dl><div><dt>可用余额</dt><dd>{money(data.wallet.available)}</dd></div><div><dt>冻结金额</dt><dd>{money(data.wallet.held)}</dd></div><div><dt>已到账佣金</dt><dd>{money(data.wallet.earned)}</dd></div></dl><a href="/?view=app&page=wallet">充值、提现与资金流水 →</a></section>
    {!ready?<section><h2>任务暂未开放</h2><p>平台正在配置佣金规则，请稍后刷新。</p></section>:<>
     <section><h2>结算规则</h2><p>佣金比例 {data.commissionPolicy.rate_bps!/100}%。领取时冻结本金，提交作品并审核通过后，返还本金与佣金。已领取任务按领取时约定的金额结算。</p></section>
     {!eligible&&stage===2&&<p>完成第一阶段任务并通过审核后，可领取本阶段任务。</p>}
     {!eligible&&stage===3&&<EnrollmentCard/>}
     {stage===3&&<div className="stage-daily-count"><span>{data.dispatch.day} · 北京时间</span><b>今日已领取 {data.dispatch.claimed} / {data.dispatch.limit} 单</b>{dailyLimitReached&&<small>今日名额已用完，未完成任务仍可继续。</small>}</div>}
     <section><h2>可领取任务</h2>{tasks.length===0&&<p>本阶段暂无上架任务。</p>}
      {tasks.map(task=>{
       const active=assignments.find(a=>a.task_id===task.id&&live(a)),terms=active?.task||task;
       const disabled=claiming||!active&&(dailyLimitReached||data.wallet.available<task.deposit||task.remaining<1||!!connectionError);
       return <article key={task.id} className={terms.premium?'stage-premium-task':''}><img src={terms.cover} alt=""/><div>
        <h3>{!!terms.premium&&<small className="stage-premium-label">✦ 高阶创作邀请</small>}{terms.title}</h3>
        <p>{active?'已冻结本金':'冻结本金'} {money(terms.deposit)} · 佣金 {money(terms.commission)}</p><small>{active?statusText[active.status]:'剩余 '+task.remaining+' 个名额'} · 提交 {terms.posts} 条作品</small>
        {eligible&&<button disabled={disabled} onClick={()=>active?location.assign(assignmentUrl(active.id)):void claim(task)}>{active?'继续当前任务':claiming?'正在领取…':'冻结 '+money(task.deposit)+' 并领取'}</button>}
        {!active&&eligible&&data.wallet.available<task.deposit&&<small>可用余额不足，请先办理充值。</small>}
        {eligible&&<a href={'/?view=app&page=detail&task='+encodeURIComponent(task.id)}>查看任务要求 →</a>}
       </div></article>;
      })}
     </section>
    </>}
    <section><h2>我的阶段记录</h2>{assignments.length===0&&<p>尚无领取记录。</p>}{assignments.map(a=><article key={a.id}><div><h3>{a.task.title}</h3><p>{statusText[a.status]} · 本金 {money(a.task.deposit)} · 佣金 {money(a.task.commission)}</p><a href={assignmentUrl(a.id)}>查看进度与提交作品 →</a></div></article>)}</section>
   </>}
  </main></MobileScroll>
 </div>;
}
