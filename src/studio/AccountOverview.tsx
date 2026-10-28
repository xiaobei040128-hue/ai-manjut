import {translateText as tx,localizeNode as lx} from "../i18n/translate";
import {IdentityIcon as PersonIcon,PaymentIcon as CardStackIcon} from './PlatformIcons';
import {useEffect,useState} from "react";
import {LockClosedIcon,ChevronRightIcon} from "@radix-ui/react-icons";
import {api} from "../api";
import {financeStatus,type FinanceSnapshot} from "../finance";

export function AccountReadiness({onWallet}:{onWallet:()=>void}){
 const [data,setData]=useState<FinanceSnapshot|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;void api<FinanceSnapshot>('/finance').then(v=>{if(active)setData(v);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 return <section className="v3-account"><header><div><span>{tx("ACCOUNT DETAILS")}</span><h2>{tx("认证与收款")}</h2></div><span className={'v3-account-badge '+(data?.account.frozen?'warning':'')}>{lx(data?data.account.frozen?'账号已冻结':'账号正常':error?'暂未获取':'读取中')}</span></header>
 {lx(data&&<><button className="v3-account-row" onClick={onWallet}><span><PersonIcon/></span><div><b>{tx("实名认证")}</b><small>{lx(data.identity?'查看认证资料与结果':'提交本人身份资料')}</small></div><em>{lx(data.identity?financeStatus(data.identity.status):'待提交')}</em><ChevronRightIcon/></button><button className="v3-account-row" onClick={onWallet}><span><CardStackIcon/></span><div><b>{tx("收款方式")}</b><small>{tx("查看与管理本人的收款方式")}</small></div><em>{lx(data.cards.length)}{tx(" 个已添加")}</em><ChevronRightIcon/></button></>)}
 {lx(error&&<p className="v3-inline-error" role="alert">{lx(error)}</p>)}<footer><LockClosedIcon/>{tx("认证状态与钱包审批记录同步")}</footer></section>;
}
