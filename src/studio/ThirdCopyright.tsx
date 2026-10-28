import {useLanguage} from '../i18n/language';
import {translateText as tx,localizeNode as lx} from "../i18n/translate";
import {premiumSettlement} from './settlement-award';
import './third-experience.css';
import TaskCelebration from './TaskCelebration';
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {api,money,type Assignment} from '../api';
import JourneyEffects,{type JourneyEvent} from './JourneyEffects';
import './stage-work.css';
import './stage-journey.css';
import './purchase-page.css';
import './third-copyright.css';
type License={assignment:Assignment;code:string|null;first?:boolean};
export default function ThirdCopyright({assignmentId}:{assignmentId:string}){
 const language=useLanguage();
 const [data,setData]=useState<License|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[manual,setManual]=useState(false),[event,setEvent]=useState<JourneyEvent|null>(null);
 const [premiumReward,setPremiumReward]=useState<Assignment|null>(null);
 const lock=useRef(false),alive=useRef(true);
 const scroll=useRef<HTMLDivElement>(null),settlementScroll=useRef<number|null>(null);
 useLayoutEffect(()=>{if(settlementScroll.current!==null&&scroll.current){scroll.current.scrollTop=settlementScroll.current;settlementScroll.current=null;}},[data]);
 const close=useCallback(()=>setEvent(null),[]);
 const load=useCallback(async()=>{try{const next=await api<License>('/stage-finance/license?assignment='+encodeURIComponent(assignmentId));if(alive.current){setData(next);setError('');}}catch(e){if(alive.current)setError((e as Error).message);}},[assignmentId]);
 useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;};},[load]);
 useEffect(()=>{document.title=tx('版权任务')+' · AI CREATOR';});
 async function complete(copy=true){
  if(lock.current||!data?.code)return;lock.current=true;settlementScroll.current=scroll.current?.scrollTop??null;setBusy(true);setError('');
  try{
   if(copy)try{await navigator.clipboard.writeText(data.code);}catch{setManual(true);setError('自动复制未成功，请手动复制上方版权码，再点击下方按钮完成。');return;}
   const next=await api<License>('/stage-finance/license/complete','POST',{assignmentId,code:data.code});
   if(next.assignment.id!==assignmentId)throw new Error('任务记录不匹配，请刷新后重试。');
   if(alive.current){setData(next);setManual(false);const premium=premiumSettlement(assignmentId,next);if(premium)setPremiumReward(premium);else if(next.first)setEvent({kind:'reward',nonce:Date.now(),amount:money(next.assignment.task.commission),title:'版权任务已完成',subtitle:'版权金额已返还，佣金已到账。'});}
  }catch(e){if(alive.current)setError((e as Error).message);}finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 const a=data?.assignment,done=a?.status==='completed',cancelled=a?.status==='cancelled';
 return <div className="studio native-mode stage-work purchase-page third-copyright-page"><TaskCelebration copyright award={premiumReward&&a&&premiumReward.id===a.id?{id:a.id,title:a.task.title,amount:a.task.deposit,commission:a.task.commission,kind:'settled'}:null} onClose={()=>{if(a)try{localStorage.setItem('studio-settlement-seen:'+a.owner_id+':'+a.id,'1');}catch{}setPremiumReward(null);}}/><JourneyEffects event={event} onClose={close}/><header><a href="/?view=app&design=third">{tx("‹ 返回今日任务")}</a><h1>{tx("版权任务")}</h1><a href="/?view=app&page=wallet">{tx("钱包")}</a></header><div className="third-copyright-scroll" ref={scroll}><main>
 {lx(error&&<p role="alert">{lx(error)}</p>)}{lx(!data&&<section><p>{tx("正在读取版权记录…")}</p>{lx(error&&<button onClick={()=>void load()}>{tx("重新读取")}</button>)}</section>)}
 {lx(a&&<><section className="purchase-page-intro"><div><small>{tx("作品版权")}</small><h2>{lx(done?'本次版权任务已完成':cancelled?'本次版权任务已取消':'购买成功，版权码已生成')}</h2></div></section><section className="stage-task-list"><article className={"stage-story-card"+(a.task.premium?" premium-license-card":"")}><div className="stage-story-poster"><img src={a.task.cover} alt={tx(a.task.title+'封面')}/></div><div className="stage-story-copy"><small className="stage-story-eyebrow">{lx(a.task.premium?'高阶任务 · 全集版权':done?'版权任务记录':'本次作品版权')}</small><h3>{lx(a.task.title)}</h3><div className="stage-story-specs"><span>{lx(a.task.genre)}</span>{lx(!!a.task.premium&&<span className="premium-license-badge">{tx("全集版权 · 高阶专属")}</span>)}</div><h4>{tx("剧情概览")}</h4><p>{lx(a.task.description)}</p></div><div className="stage-story-checkout"><div className="stage-purchase-summary"><div><span>{lx(done||cancelled?'已返还版权金额':'版权金额')}</span><b>{lx(money(a.task.deposit))}</b></div><div><span>{lx(done?'已到账佣金':'完成佣金')}</span><b>{lx(money(cancelled?0:a.task.commission))}</b></div></div>
 {lx(!cancelled&&<><h3>{tx("你的版权码")}</h3><input className="newcomer-copyright-code" aria-label={tx("作品版权码")} value={data.code||''} readOnly onFocus={e=>e.currentTarget.select()}/></>)}
 {lx(done?<><p>{tx("版权码已提交，本次任务已完成，版权金额和佣金已记入钱包。")}</p><a className="copyright-primary-link" href="/?view=app&design=third">{tx("继续今日任务 →")}</a><a href="/?view=app&page=wallet">{tx("查看到账明细 →")}</a></>:cancelled?<a className="purchase-topup" href="/?view=app&design=third">{tx("返回今日任务 →")}</a>:<><button disabled={busy||!data.code} onClick={()=>void complete()}>{lx(busy?'正在完成…':'复制并完成任务')}</button>{lx(manual&&<button disabled={busy} onClick={()=>void complete(false)}>{tx("已手动复制，完成任务")}</button>)}</>)}
 </div></article></section></>)}
 </main></div></div>;
}
