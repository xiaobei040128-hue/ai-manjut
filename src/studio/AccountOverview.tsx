import {useEffect,useState} from "react";
import {PersonIcon,CardStackIcon,LockClosedIcon,ChevronRightIcon,CheckIcon,CopyIcon,ReaderIcon,ArrowRightIcon} from "@radix-ui/react-icons";
import {api,date} from "../api";
import {financeStatus,type FinanceSnapshot} from "../finance";
import {useAccountJourney} from "./AccountJourney";
export function AccountReadiness({id,createdAt,onWallet}:{id:string;createdAt:string;onWallet:()=>void}){
 const [data,setData]=useState<FinanceSnapshot|null>(null),[error,setError]=useState(''),[copied,setCopied]=useState(false);
 useEffect(()=>{let active=true;void api<FinanceSnapshot>('/finance').then(v=>{if(active)setData(v);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 return <section className="v3-account"><header><div><span>ACCOUNT DETAILS</span><h2>账号与认证</h2></div><span className={'v3-account-badge '+(data?.account.frozen?'warning':'')}>{data?data.account.frozen?'账号已冻结':'账号正常':error?'暂未获取':'读取中'}</span></header><div className="v3-account-id"><div><span>账号编号</span><b>{id.slice(0,8).toUpperCase()}</b></div><button aria-label="复制完整账号编号" onClick={()=>void navigator.clipboard.writeText(id).then(()=>{setCopied(true);setError('');}).catch(()=>setError('复制失败，请稍后重试'))}>{copied?<CheckIcon/>:<CopyIcon/>}{copied?'已复制':'复制'}</button></div><p className="v3-account-date">加入于 {date(createdAt)}</p>
 {data&&<><button className="v3-account-row" onClick={onWallet}><span><PersonIcon/></span><div><b>实名认证</b><small>{data.identity?'查看申请与审核结果':'提交证件资料，等待平台审核'}</small></div><em>{data.identity?financeStatus(data.identity.status):'待提交'}</em><ChevronRightIcon/></button><button className="v3-account-row" onClick={onWallet}><span><CardStackIcon/></span><div><b>银行卡</b><small>查看与管理本人的提款方式</small></div><em>{data.cards.filter(c=>c.status==='approved').length} 张已通过</em><ChevronRightIcon/></button></>}
 {error&&<p className="v3-inline-error" role="alert">{error}</p>}<footer><LockClosedIcon/>认证状态与钱包审批记录同步</footer></section>;
}
export function JourneyRecord(){
 const {newcomer,advanced}=useAccountJourney();
 const stage=newcomer.stage===6?2:1,done=stage===2?(advanced.community?.completed??0):newcomer.stage,percent=Math.round(done/(stage===2?5:6)*100);
 return <a className="v3-journey-record" href={'/?view=app&design='+(stage===2?'advanced':'newcomer')}><span className="v3-journey-icon"><ReaderIcon/></span><div><small>成长阶段 · 0{stage}</small><b>{stage===2?'AI 漫剧探索计划':'新手创作旅程'}</b><progress value={percent} max={100} aria-label="成长阶段完成进度"/></div><span className="v3-journey-percent">{percent}%<ArrowRightIcon/></span></a>;
}
