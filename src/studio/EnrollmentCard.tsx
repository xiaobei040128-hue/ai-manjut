import {translateText as tx,localizeNode as lx} from "../i18n/translate";
import {useCallback,useEffect,useRef,useState} from "react";
import {ArrowRightIcon,CheckIcon,ClockIcon,ReloadIcon,Cross2Icon,LockClosedIcon} from "@radix-ui/react-icons";
import {api,date} from "../api";
import "./enrollment-card.css";
interface EnrollmentState {eligible:boolean;withdrawalComplete:boolean;enrollment:null|{id:string;status:string;note:string;created_at:string;reviewed_at:string|null}}
export default function EnrollmentCard(){
 const [state,setState]=useState<EnrollmentState|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[refreshing,setRefreshing]=useState(false);
 const alive=useRef(true),lock=useRef(false),reading=useRef<number|null>(null),version=useRef(0);
 const read=useCallback(async()=>{if(lock.current||reading.current!==null)return;const current=++version.current;reading.current=current;setRefreshing(true);try{const v=await api<EnrollmentState>('/stage-three/enrollment');if(alive.current&&current===version.current){setState(v);setError('');}}catch(e){if(alive.current&&current===version.current)setError((e as Error).message);}finally{if(reading.current===current)reading.current=null;if(alive.current&&current===version.current)setRefreshing(false);}},[]);
 useEffect(()=>{alive.current=true;void read();const focus=()=>void read();const timer=setInterval(()=>{if(document.visibilityState==='visible')void read();},30000);window.addEventListener('focus',focus);return()=>{alive.current=false;version.current++;reading.current=null;clearInterval(timer);window.removeEventListener('focus',focus);};},[read]);
 const status=state?.enrollment?.status||'none',approved=status==='approved',pending=status==='pending',rejected=status==='rejected';
 const Icon=approved?CheckIcon:pending?ClockIcon:rejected?Cross2Icon:LockClosedIcon;
 async function apply(){if(lock.current)return;lock.current=true;const current=++version.current;setRefreshing(false);setBusy(true);setError('');try{const v=await api<EnrollmentState>('/stage-three/enrollment','POST',{});if(alive.current&&current===version.current)setState(v);}catch(e){if(alive.current)setError((e as Error).message);}finally{lock.current=false;if(alive.current)setBusy(false);}}
 return <section className={'en-card en-'+status} aria-label={tx("下一段旅程报名")} aria-busy={busy}>
 <div className="en-top"><span>{tx("YOUR NEXT CHAPTER")}</span><span className="en-badge">{lx(!state?'正在读取':approved?'资格已开通':pending?'审核中':rejected?'需重新申请':'待报名')}</span></div>
 <div className="en-heading"><span className="en-icon"><Icon/></span><div><h2>{lx(approved?'下一阶段，已为你开启':pending?'报名已提交':rejected?'报名暂未通过':'开启你的下一段旅程')}</h2><p>{tx("下一段旅程 · 报名资格")}</p></div></div>
 {lx(!state&&!error?<div className="en-loading" role="status">{tx("正在读取账号报名信息…")}</div>:state&&<>
 <p className="en-description">{lx(!state.eligible?'完成当前计划后，即可申请报名。':approved?'报名审核通过，新的创作旅程已开启。':pending?'审核结果会在这里更新。':rejected?'查看审核意见后，可以重新提交报名。':!state.withdrawalComplete?'本阶段已完成，提交全部余额的提款申请后，即可报名下一阶段。':'提款申请已提交，可以报名下一阶段。')}</p>
 {lx(state.enrollment?.note&&<div className="en-feedback"><b>{tx("审核意见")}</b><p>{lx(state.enrollment.note)}</p></div>)}
 {lx(approved?<a className="en-primary" href="/?view=app&design=third">{tx("开启新的旅程")}<ArrowRightIcon/></a>:!pending?<button className="en-primary" disabled={busy||!state.eligible||!state.withdrawalComplete} onClick={()=>void apply()}>{lx(busy?'正在提交…':rejected?'重新申请报名':'申请报名')}<ArrowRightIcon/></button>:<div className="en-waiting" role="status"><span/>{tx("等待审核")}</div>)}
 {lx(state.enrollment&&<div className="en-receipt"><span>{tx("申请编号 ")}<b>{lx(state.enrollment.id.slice(0,8).toUpperCase())}</b></span><time>{lx(date(state.enrollment.created_at,true))}</time></div>)}
 </>)}
 {lx(error&&<p role="alert" className="en-error">{lx(error)}</p>)}
 <footer className="en-footer"><span>{lx(pending?'申请已提交':approved?'报名已通过':'申请进度')}</span><button className="en-refresh" disabled={busy||refreshing} onClick={()=>void read()}><ReloadIcon className={refreshing?'en-spin':''}/>{lx(refreshing?'更新中':'刷新状态')}</button></footer>
 </section>;
}
