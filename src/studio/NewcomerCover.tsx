import {useEffect,useRef,useState} from 'react';
import {api,money} from '../api';
import {type JourneySnapshot} from './NewcomerProgress';
import {CopyIcon,CheckIcon,ArrowRightIcon} from '@radix-ui/react-icons';
export default function NewcomerCover({data,onUpdate,onComplete}:{data:JourneySnapshot;onUpdate:(next:JourneySnapshot)=>void;onComplete:(commission:number)=>void}){
 const order=data.cover,[busy,setBusy]=useState(false),[error,setError]=useState(''),[manual,setManual]=useState(false);
 const lock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 if(!order)return null;
 async function purchase(){
  if(lock.current||!order)return;lock.current=true;setBusy(true);setError('');
  try{const next=await api<JourneySnapshot>('/stage-journey/cover/purchase','POST',{orderId:order.id,expected:{amount:order.amount,commission:order.commission,rateBps:order.rateBps}});if(alive.current)onUpdate(next);}
  catch(e){if(alive.current)setError((e as Error).message);}finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 async function submit(copy=true){
  if(lock.current||!order?.code)return;lock.current=true;setBusy(true);setError('');
  try{
   if(copy){try{await navigator.clipboard.writeText(order.code);}catch{if(alive.current){setManual(true);setError('未能自动复制，请手动复制下方版权码后提交。');}return;}}
   const next=await api<JourneySnapshot&{settlement:{first:boolean;commission:number}}>('/stage-journey/cover/submit','POST',{orderId:order.id,code:order.code});
   if(alive.current){onUpdate(next);if(next.settlement.first)onComplete(next.settlement.commission);}
  }catch(e){if(alive.current)setError((e as Error).message);}finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 return <section className="newcomer-cover-card">
 <div className="newcomer-cover-art"><img src={order.artwork.cover} alt={order.artwork.title+'版权封面'}/><span>YOUR FIRST COLLECTION</span></div>
 <div className="newcomer-cover-copy"><small>版权封面</small><h2>{order.artwork.title}</h2><div className="newcomer-cover-tags"><span>{order.artwork.genre}</span>{order.artwork.episodes&&<span>{order.artwork.episodes} 集</span>}{order.artwork.language&&<span>{order.artwork.language}</span>}</div>
 {order.state==='offered'?<><h3>剧情概览</h3><p>{order.artwork.description}</p><div className="newcomer-cover-price"><div><span>购买金额</span><strong>{money(order.amount)}</strong></div><div><span>完成佣金</span><strong>{order.commission===null?'—':money(order.commission)}</strong></div></div><button className="newcomer-cta" disabled={busy||order.rateBps===null} onClick={()=>void purchase()}>{busy?'正在购买…':'购买版权封面 · '+money(order.amount)}<ArrowRightIcon/></button></>
 :<><div className="newcomer-cover-success"><CheckIcon/>购买成功</div><h3>你的版权码</h3><input className="newcomer-copyright-code" aria-label="版权码" value={order.code||''} readOnly onFocus={e=>e.currentTarget.select()}/><p>复制并提交版权码，即可完成本次任务。</p><button className="newcomer-cta" disabled={busy} onClick={()=>void submit()}>{busy?'正在提交…':'复制并提交版权码'}<CopyIcon/></button>{manual&&<button className="newcomer-manual-submit" disabled={busy} onClick={()=>void submit(false)}>已手动复制，提交版权码</button>}</>}
 {error&&<p role="alert">{error}</p>}
 </div></section>;
}
