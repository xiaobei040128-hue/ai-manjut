import {useCallback,useEffect,useRef,useState} from "react";
import {ArrowRightIcon,CheckIcon,ClockIcon,ReloadIcon,Cross2Icon,LockClosedIcon} from "@radix-ui/react-icons";
import {api,date} from "../api";
import {useAccountJourney} from "./AccountJourney";
import "./enrollment-card.css";
interface EnrollmentState {eligible:boolean;enrollment:null|{id:string;status:string;note:string;created_at:string;reviewed_at:string|null}}
export default function EnrollmentCard(){
 const {flush}=useAccountJourney();
 const [state,setState]=useState<EnrollmentState|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[refreshing,setRefreshing]=useState(false);
 const alive=useRef(true),lock=useRef(false),reading=useRef(false);
 const read=useCallback(async()=>{if(lock.current||reading.current)return;reading.current=true;setRefreshing(true);try{const v=await api<EnrollmentState>('/stage-three/enrollment');if(alive.current){setState(v);setError('');}}catch(e){if(alive.current)setError((e as Error).message);}finally{reading.current=false;if(alive.current)setRefreshing(false);}},[]);
 useEffect(()=>{alive.current=true;void read();const focus=()=>void read();const timer=setInterval(()=>{if(document.visibilityState==='visible')void read();},30000);window.addEventListener('focus',focus);return()=>{alive.current=false;clearInterval(timer);window.removeEventListener('focus',focus);};},[read]);
 const status=state?.enrollment?.status||'none',approved=status==='approved',pending=status==='pending',rejected=status==='rejected';
 const Icon=approved?CheckIcon:pending?ClockIcon:rejected?Cross2Icon:LockClosedIcon;
 async function apply(){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await flush();const v=await api<EnrollmentState>('/stage-three/enrollment','POST',{});if(alive.current)setState(v);}catch(e){if(alive.current)setError((e as Error).message);}finally{lock.current=false;if(alive.current)setBusy(false);}}
 return <section className={'en-card en-'+status} aria-label="第三阶段报名" aria-busy={busy}>
 <div className="en-top"><span>CHAPTER 03</span><span className="en-badge">{!state?'正在读取':approved?'资格已开通':pending?'审核中':rejected?'需重新申请':'待报名'}</span></div>
 <div className="en-heading"><span className="en-icon"><Icon/></span><div><h2>{approved?'下一阶段，已为你开启':pending?'报名已提交':rejected?'报名暂未通过':'开启你的下一段旅程'}</h2><p>第三阶段 · 报名资格</p></div></div>
 {!state&&!error?<div className="en-loading" role="status">正在读取账号报名信息…</div>:state&&<>
 <p className="en-description">{!state.eligible?'完成第二阶段后，即可申请报名。':approved?'报名审核通过，现在可以进入第三阶段。':pending?'申请已送达平台，审核结果会在这里自动更新。':rejected?'查看审核意见后，可以重新提交报名。':'第二阶段已完成，提交报名后由平台审核。'}</p>
 <ol className="en-steps" aria-label="报名进度"><li className={status!=='none'?'is-done':'is-current'}><span>{status!=='none'?<CheckIcon/>:'1'}</span>提交报名</li><li className={approved||rejected?'is-done':pending?'is-current':''}><span>{approved||rejected?<CheckIcon/>:'2'}</span>平台审核</li><li className={approved?'is-done':''}><span>{approved?<CheckIcon/>:'3'}</span>开放入口</li></ol>
 {state.enrollment?.note&&<div className="en-feedback"><b>审核意见</b><p>{state.enrollment.note}</p></div>}
 {approved?<a className="en-primary" href="/?view=app&design=third">进入第三阶段<ArrowRightIcon/></a>:!pending?<button className="en-primary" disabled={busy||!state.eligible} onClick={()=>void apply()}>{busy?'正在提交…':rejected?'重新申请报名':'申请报名'}<ArrowRightIcon/></button>:<div className="en-waiting" role="status"><span/>等待平台审核</div>}
 {state.enrollment&&<div className="en-receipt"><span>申请编号 <b>{state.enrollment.id.slice(0,8).toUpperCase()}</b></span><time>{date(state.enrollment.created_at,true)}</time></div>}
 </>}
 {error&&<p role="alert" className="en-error">{error}</p>}
 <footer className="en-footer"><span>{pending?'审核结果自动同步':approved?'报名已通过':'按账号独立记录'}</span><button className="en-refresh" disabled={busy||refreshing} onClick={()=>void read()}><ReloadIcon className={refreshing?'en-spin':''}/>{refreshing?'更新中':'刷新状态'}</button></footer>
 </section>;
}
