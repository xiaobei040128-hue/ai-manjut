import {useCallback,useEffect,useRef,useState} from 'react';
import {api,money} from '../api';
import {MobileScroll,KeyboardInput,KeyboardTextarea} from '../mobile';
import JourneyEffects,{type JourneyEvent} from './JourneyEffects';
import {type JourneySnapshot} from './NewcomerProgress';
import EnrollmentCard from './EnrollmentCard';
import {playWelcomeChime,unlockWelcomeAudio} from './welcome-audio';
import './stage-journey.css';
const titles=['认识 AI 漫剧','写下你的感受','填写喜欢的漫剧题材','购买单集版权','购买单集版权'];
export default function CommunityJourney(){
 const [data,setData]=useState<JourneySnapshot|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[event,setEvent]=useState<JourneyEvent|null>(null);
 const [answer,setAnswer]=useState(-1),[reading,setReading]=useState(false),[genre,setGenre]=useState(''),[rating,setRating]=useState(0),[review,setReview]=useState(''),[code,setCode]=useState(''),[copied,setCopied]=useState(false);
 const alive=useRef(true),lock=useRef(false),stopSound=useRef<()=>void>(()=>{});
 const close=useCallback(()=>setEvent(null),[]);
 useEffect(()=>{alive.current=true;let live=true;void api<JourneySnapshot>('/stage-journey/sync','POST',{}).then(v=>{if(live)setData(v);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;alive.current=false;stopSound.current();};},[]);
 const c=data?.community,done=c?.completed===5,step=c?.completed??0,revealed=c?.revealed===step;
 async function act(kind:'reveal'|'submit'|'license/purchase',payload:Record<string,unknown>={}){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');void unlockWelcomeAudio();
  try{const next=await api<JourneySnapshot&{taskReward?:number}>('/stage-journey/'+kind,'POST',{step,...payload});if(!alive.current)return;setData(next);if(kind==='license/purchase')return;setEvent({kind:kind==='reveal'?'task':next.community.completed===5?'complete':'reward',nonce:Date.now(),amount:next.taskReward!==undefined?money(next.taskReward):undefined,title:kind==='reveal'?titles[next.community.completed]:next.community.completed===5?'本章探索完成':'探索进度已更新',subtitle:kind==='reveal'?'开启属于你的这一次探索。':'已保存至你的账号。'});stopSound.current();stopSound.current=playWelcomeChime(0);setAnswer(-1);setReading(false);setGenre('');setRating(0);setReview('');setCode('');}
  catch(e){if(alive.current){setError((e as Error).message);void api<JourneySnapshot>('/stage-journey').then(v=>{if(alive.current)setData(v);}).catch(()=>{});}}finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 async function share(){try{if(navigator.share)await navigator.share({title:'发现 AI 漫剧',text:'我正在探索 AI 漫剧：喜欢的故事，也可以有新的表达方式。'});else{await navigator.clipboard.writeText('我正在探索 AI 漫剧：喜欢的故事，也可以有新的表达方式。');setCopied(true);}}catch{setCopied(false);}}
 return <div className="studio native-mode stage-work community-journey"><JourneyEffects event={event} onClose={close}/><header><a href="/?view=app">‹ 返回首页</a><h1>故事探索计划</h1><span>EXPLORE</span></header><MobileScroll className="stage-work-scroll"><main>
 <section className="journey-community-hero"><small>EXPLORE · CREATE · CONNECT</small><h2>让好故事<br/>被更多人看见。</h2><p>AI 漫剧探索计划</p><strong>{step*20}%</strong><progress max={5} value={step}/></section>
 {error&&<p role="alert">{error}</p>}{!data&&<p>正在读取探索记录…</p>}
 {data&&!data.newcomer.complete?<section><h2>先完成你的第一章</h2><p>完成新手成长计划后，开启五项探索。</p><a href="/?view=app&design=newcomer">继续新手成长计划 →</a></section>:data&&<section className="journey-community-task"><small>{done?'CHAPTER COMPLETE':'MISSION '+String(step+1).padStart(2,'0')}</small><h2>{done?'探索完成，感谢你的参与':revealed?titles[step]:'一份新的探索，等待开启'}</h2>
 {!done&&!revealed&&<div className="stage-sealed-invitation"><div className="journey-invitation-art"><div className="journey-invitation-orbit"/><img src="/art/task-invitation-v1.png" alt="密封的任务邀请函"/></div><button disabled={busy} onClick={()=>void act('reveal')}>领取任务</button></div>}
 {revealed&&step===0&&<><div className="newcomer-reward-line"><span>完成奖励</span><b>$0.58</b></div><p>AI 漫剧结合 AI 辅助绘画、剧本、配音与剪辑。发布前仍需检查素材授权和内容质量。</p><h3>使用 AI 辅助创作后，是否仍需确认素材授权？</h3>{['需要，AI 生成不等于获得全部权利','不需要，所有 AI 素材都能自由商用'].map((t,i)=><button key={t} className="journey-choice" aria-pressed={answer===i} onClick={()=>setAnswer(i)}>{t}</button>)}<button className="journey-primary" disabled={busy||answer<0} onClick={()=>void act('submit',{answer})}>提交答案</button></>}
 {revealed&&step===1&&<><p>写一段你对 AI 漫剧的感受，聊聊画面、剧情或未来的可能。</p><KeyboardTextarea aria-label="AI 漫剧感受" value={review} maxLength={1000} placeholder="至少 10 个字" onChange={e=>setReview(e.target.value)}/><div className="newcomer-reward-line"><span>完成奖励</span><b>$0.66</b></div><button className="journey-primary" disabled={busy||Array.from(review.trim()).length<10} onClick={()=>void act('submit',{review})}>提交感受</button></>}
 {revealed&&step===2&&<><p>你喜欢什么漫剧题材？例如荒岛求生、末日探险、奇幻爱情。</p><KeyboardTextarea aria-label="喜欢的漫剧题材" value={genre} maxLength={100} placeholder="填写你喜欢的题材" onChange={e=>setGenre(e.target.value)}/><div className="newcomer-reward-line"><span>完成奖励</span><b>$0.77</b></div><button className="journey-primary" disabled={busy||genre.trim().length<2} onClick={()=>void act('submit',{genre})}>提交题材</button></>}
 {revealed&&step>=3&&c?.license&&<div className="community-license"><img className="journey-story-cover" src={c.license.artwork.cover} alt={c.license.artwork.title+'封面'}/><h3>{c.license.artwork.title}</h3><small>单集版权 · 第 {c.license.artwork.episode} 集 / 共 {c.license.artwork.episodes} 集</small><p>{c.license.artwork.description}</p><div className="stage-purchase-summary"><div><span>购买金额</span><b>{money(c.license.amount)}</b></div><div><span>预计收入</span><b>{money(c.license.commission)}</b></div></div>{c.license.state==='offered'?<button className="journey-primary" disabled={busy} onClick={()=>void act('license/purchase',{orderId:c.license!.id,amount:c.license!.amount,commission:c.license!.commission})}>购买单集版权 · {money(c.license.amount)}</button>:<><input className="newcomer-copyright-code" aria-label="单集版权码" value={c.license.code||''} readOnly onFocus={e=>e.currentTarget.select()}/><button className="journey-primary" disabled={busy} onClick={()=>{void (async()=>{try{await navigator.clipboard.writeText(c.license!.code!);void act('submit',{code:c.license!.code});}catch{setCopied(true);setError('请手动复制上方版权码后上传。');}})();}}>复制并上传版权码</button>{copied&&<button className="journey-choice" disabled={busy} onClick={()=>void act('submit',{code:c.license!.code})}>已复制，上传版权码</button>}</>}</div>}
 {done&&<><p>本章任务已全部完成，奖励与版权记录已保存。</p><EnrollmentCard/></>}
 </section>}
 {c&&step>0&&<section><h2>已完成的探索</h2>{titles.slice(0,step).map(t=><p key={t}>✓ {t}</p>)}</section>}
 </main></MobileScroll></div>;
}
