import {useCallback,useEffect,useRef,useState} from 'react';
import {api} from '../api';
import {MobileScroll,KeyboardInput,KeyboardTextarea} from '../mobile';
import JourneyEffects,{type JourneyEvent} from './JourneyEffects';
import {type JourneySnapshot} from './NewcomerProgress';
import EnrollmentCard from './EnrollmentCard';
import {playWelcomeChime,unlockWelcomeAudio} from './welcome-audio';
import './stage-journey.css';
const titles=['认识 AI 漫剧','发现你的故事偏好','留下你的真实评价','分享你喜欢的内容','体验授权凭证'];
export default function CommunityJourney(){
 const [data,setData]=useState<JourneySnapshot|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[event,setEvent]=useState<JourneyEvent|null>(null);
 const [answer,setAnswer]=useState(-1),[reading,setReading]=useState(false),[genre,setGenre]=useState(''),[rating,setRating]=useState(0),[review,setReview]=useState(''),[code,setCode]=useState(''),[copied,setCopied]=useState(false);
 const alive=useRef(true),lock=useRef(false),stopSound=useRef<()=>void>(()=>{});
 const close=useCallback(()=>setEvent(null),[]);
 useEffect(()=>{alive.current=true;let live=true;void api<JourneySnapshot>('/stage-journey/sync','POST',{}).then(v=>{if(live)setData(v);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;alive.current=false;stopSound.current();};},[]);
 const c=data?.community,done=c?.completed===5,step=c?.completed??0,revealed=c?.revealed===step;
 async function act(kind:'reveal'|'submit',payload:Record<string,unknown>={}){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');void unlockWelcomeAudio();
  try{const next=await api<JourneySnapshot>('/stage-journey/'+kind,'POST',{step,...payload});if(!alive.current)return;setData(next);setEvent({kind:kind==='reveal'?'task':next.community.completed===5?'complete':'reward',nonce:Date.now(),title:kind==='reveal'?titles[next.community.completed]:next.community.completed===5?'本章探索完成':'探索进度已更新',subtitle:kind==='reveal'?'开启属于你的这一次探索。':'已保存至你的账号。'});stopSound.current();stopSound.current=playWelcomeChime(0);setAnswer(-1);setReading(false);setGenre('');setRating(0);setReview('');setCode('');}
  catch(e){if(alive.current){setError((e as Error).message);void api<JourneySnapshot>('/stage-journey').then(v=>{if(alive.current)setData(v);}).catch(()=>{});}}finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 async function share(){try{if(navigator.share)await navigator.share({title:'发现 AI 漫剧',text:'我正在探索 AI 漫剧：喜欢的故事，也可以有新的表达方式。'});else{await navigator.clipboard.writeText('我正在探索 AI 漫剧：喜欢的故事，也可以有新的表达方式。');setCopied(true);}}catch{setCopied(false);}}
 return <div className="studio native-mode stage-work community-journey"><JourneyEffects event={event} onClose={close}/><header><a href="/?view=app">‹ 返回首页</a><h1>故事探索计划</h1><span>EXPLORE</span></header><MobileScroll className="stage-work-scroll"><main>
 <section className="journey-community-hero"><small>EXPLORE · CREATE · CONNECT</small><h2>让好故事<br/>被更多人看见。</h2><p>AI 漫剧探索计划</p><strong>{step*20}%</strong><progress max={5} value={step}/></section>
 {error&&<p role="alert">{error}</p>}{!data&&<p>正在读取探索记录…</p>}
 {data&&!data.newcomer.complete?<section><h2>先完成你的第一章</h2><p>完成新手成长计划后，开启五项探索。</p><a href="/?view=app&design=newcomer">继续新手成长计划 →</a></section>:data&&<section className="journey-community-task"><small>{done?'CHAPTER COMPLETE':'MISSION '+String(step+1).padStart(2,'0')}</small><h2>{done?'探索完成，感谢你的参与':revealed?titles[step]:'一份新的探索，等待开启'}</h2>
 {!done&&!revealed&&<div className="stage-sealed-invitation"><div className="journey-invitation-art"><div className="journey-invitation-orbit"/><img src="/art/task-invitation-v1.png" alt="密封的任务邀请函"/></div><button disabled={busy} onClick={()=>void act('reveal')}>领取任务</button></div>}
 {revealed&&step===0&&<><p>AI 漫剧结合 AI 辅助绘画、剧本、配音与剪辑。发布前仍需检查素材授权和内容质量。</p><h3>使用 AI 辅助创作后，是否仍需确认素材授权？</h3>{['需要，AI 生成不等于获得全部权利','不需要，所有 AI 素材都能自由商用'].map((t,i)=><button key={t} className="journey-choice" aria-pressed={answer===i} onClick={()=>setAnswer(i)}>{t}</button>)}<button className="journey-primary" disabled={busy||answer<0} onClick={()=>void act('submit',{answer})}>提交答案</button></>}
 {revealed&&step===1&&<><img className="journey-story-cover" src="/art/wolf-v2.webp" alt="狼人王子的契约新娘封面"/><h3>狼人王子的契约新娘</h3><p>月夜下，一纸契约将两人的命运连在一起。</p><button className="journey-choice" onClick={()=>setReading(true)}>阅读故事节选</button>{reading&&<blockquote>钟声响起，她推开古堡的大门。桌上只留着一封信：“如果你决定留下，请在黎明前找到我。”</blockquote>}<h3>你最喜欢哪种题材？</h3>{['奇幻爱情','都市情感','重生逆袭','青春校园','末日冒险'].map(g=><button key={g} className="journey-choice" aria-pressed={genre===g} onClick={()=>setGenre(g)}>{g}</button>)}<button className="journey-primary" disabled={busy||!reading||!genre} onClick={()=>void act('submit',{read:reading,genre})}>保存偏好并完成</button></>}
 {revealed&&step===2&&<><p>喜欢与不喜欢，都值得被听见。</p><div className="journey-rating">{[1,2,3,4,5].map(n=><button key={n} aria-label={n+' 星'} aria-pressed={rating===n} onClick={()=>setRating(n)}>{n<=rating?'★':'☆'}</button>)}</div><KeyboardTextarea aria-label="你的评价" value={review} maxLength={500} placeholder="聊聊剧情、画面或配音，至少 5 个字" onChange={e=>setReview(e.target.value)}/><button className="journey-primary" disabled={busy||!rating||review.trim().length<5} onClick={()=>void act('submit',{rating,review})}>提交评价</button></>}
 {revealed&&step===3&&<><p>将喜欢的内容带给朋友。是否分享由你决定，不影响后续流程。</p><blockquote>我正在探索 AI 漫剧：喜欢的故事，也可以有新的表达方式。</blockquote><button className="journey-choice" onClick={()=>void share()}>{copied?'文案已复制':'选择分享方式 / 复制文案'}</button><button className="journey-primary" disabled={busy} onClick={()=>void act('submit',{shared:true})}>我已自行分享，继续</button><button className="journey-choice" disabled={busy} onClick={()=>void act('submit',{shared:false})}>暂不分享，继续</button></>}
 {revealed&&step===4&&<><p>核对平台体验凭证。作品的商业授权范围与权利人许可，仍以对应作品资料为准。</p><div className="journey-code" aria-label="当前体验凭证">{c?.code}</div><KeyboardInput aria-label="填写凭证编号" value={code} maxLength={8} placeholder="输入上方 8 位编号" onChange={e=>setCode(e.target.value.toUpperCase().trim())}/><button className="journey-primary" disabled={busy||code!==c?.code} onClick={()=>void act('submit',{code})}>提交凭证并完成</button></>}
 {done&&<><p>知识问答、故事偏好、评价、分享选择与凭证核验已保存。</p><EnrollmentCard/></>}
 </section>}
 {c&&step>0&&<section><h2>已完成的探索</h2>{titles.slice(0,step).map(t=><p key={t}>✓ {t}</p>)}</section>}
 </main></MobileScroll></div>;
}
