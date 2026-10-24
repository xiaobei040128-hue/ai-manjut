import {useEffect,useRef,useState} from "react";
import {ArrowRightIcon,CheckIcon,ChevronDownIcon,ReloadIcon,ReaderIcon,LockClosedIcon} from "@radix-ui/react-icons";
import {api,ApiError,money} from "../api";
import {KeyboardInput,MobileScroll,useKeyboard} from "../mobile";
import EnrollmentCard from "./EnrollmentCard";
import LicensePreview from "./LicensePreview";
import "./community-stage.css";
import "./third-stage.css";
interface Daily {day:string;walletAvailable:number;example:null|{balance:number;source:string;items:{sequence:number;portion:number;amount:number;rate:number;commission:number}[]}}
export default function StageThree(){
 const [access,setAccess]=useState<boolean|null>(null),[error,setError]=useState(''),[daily,setDaily]=useState<Daily|null>(null),[source,setSource]=useState('wallet'),[balance,setBalance]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const keyboard=useKeyboard(),alive=useRef(true),inflight=useRef(false);
 async function load(){setLoading(true);setError('');try{const value=await api<Daily>('/stage-three/example');if(alive.current){setAccess(true);setDaily(value);}}catch(e){if(alive.current){if(e instanceof ApiError&&e.status===403)setAccess(false);else setError((e as Error).message);}}finally{if(alive.current)setLoading(false);}}
 useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;};},[]);
 async function generate(){if(inflight.current)return;inflight.current=true;keyboard.hide();setBusy(true);setError('');try{const value=await api<Daily>('/stage-three/example','POST',{source,balance});if(alive.current)setDaily(value);}catch(e){if(alive.current)setError((e as Error).message);}finally{inflight.current=false;if(alive.current)setBusy(false);}}
 const example=daily?.example;
 return <div className="studio community-stage third-stage native-mode"><header className="community-header"><a href="/?view=app" onClick={()=>keyboard.hide()}>‹ 返回</a><b>第三阶段</b><span>不计入真实资金</span></header><MobileScroll className="community-scroll"><div className="community-content">
 <section className="t-hero"><div className="t-eyebrow"><span>CHAPTER 03</span><span className="t-access">{access?<CheckIcon/>:<LockClosedIcon/>}{access?'报名已通过':'资格待确认'}</span></div><h1>{access?'探索下一部好作品':'下一段旅程'}</h1><p>{access?'版权选购 · 作品即将揭晓':'报名审核通过后，开启这一章。'}</p></section>
 {loading&&<div className="t-status" role="status"><ReloadIcon className="t-spin"/>正在读取账号记录…</div>}
 {!loading&&access===false&&<EnrollmentCard/>}
 {error&&<div className="t-error" role="alert"><p>{error}</p><button onClick={()=>void load()} disabled={loading}>重新读取</button></div>}
 {access&&<LicensePreview/>}
 {access&&daily&&<details className="t-calculation"><summary>独立计算工具<ChevronDownIcon/></summary><p>计算示例不对应上方作品价格，也不参与购买、奖励或提现。</p>
 {access&&daily&&!example&&<section className="t-panel"><div className="t-panel-title"><ReaderIcon/><h2>准备今日示例</h2></div><p className="t-caption">选择本次计算的余额来源</p><div className="t-source"><button aria-pressed={source==='wallet'} disabled={busy} onClick={()=>setSource('wallet')}><span>账号余额</span><b>{money(daily.walletAvailable)}</b><small>读取当前可用余额</small></button><button aria-pressed={source==='demo'} disabled={busy} onClick={()=>setSource('demo')}><span>演示余额</span><b>自定义金额</b><small>仅用于本次计算</small></button></div>{source==='demo'&&<label className="t-field">演示余额 · USD<KeyboardInput aria-label="演示余额 USD" inputMode="decimal" value={balance} onChange={e=>setBalance(e.target.value)} placeholder="例如 100.00"/></label>}<button className="t-primary" disabled={busy||source==='demo'&&!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(balance)} onClick={()=>void generate()}>{busy?'正在生成…':'生成今日示例'}<ArrowRightIcon/></button><div className="t-date">{daily.day} · 北京时间 · 当日生成后固定</div></section>}
 {access&&daily&&example&&<><div className="t-overview"><div><span>今日示例</span><strong>{example.items.length}<small> 条</small></strong></div><div><span>账号可用余额</span><strong>{money(daily.walletAvailable)}</strong></div><div><span>记录日期</span><strong>{daily.day.slice(5).replace('-',' / ')}</strong></div></div><section className="t-ledger"><header><div><span>DAILY RECORD</span><h2>今日计算明细</h2></div><span className="t-fixed"><CheckIcon/>已固定</span></header><p className="t-caption">展开查看比例、单价与佣金的计算过程。</p><div className="t-rows">{example.items.map(item=><details className="t-row" key={item.sequence}><summary><div className="t-row-name"><span>{String(item.sequence).padStart(2,'0')}</span><div><b>金额示例</b><small>比例 {(item.portion/100).toFixed(2)}% · 佣金率 {(item.rate/100).toFixed(2)}%</small></div></div><div className="t-row-price"><b>{money(item.amount)}</b><small>佣金计算 {money(item.commission)}</small></div><ChevronDownIcon/></summary><div className="t-formulas"><div><span>单价</span><p>{money(example.balance)} × {(item.portion/100).toFixed(2)}% = <b>{money(item.amount)}</b></p></div><div><span>佣金</span><p>{money(item.amount)} × {(item.rate/100).toFixed(2)}% = <b>{money(item.commission)}</b></p></div></div></details>)}</div><footer>{daily.day} · 北京时间 · 刷新后保留本日记录</footer></section></>}
 </details>}
 </div></MobileScroll></div>;
}
