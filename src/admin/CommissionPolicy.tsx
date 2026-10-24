import {useEffect,useRef,useState} from 'react';
import {api,money} from '../api';
export default function CommissionPolicy(){
 const [rate,setRate]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('');
 const lock=useRef(false);
 useEffect(()=>{let alive=true;void api<{rate_bps:number|null}>('/admin/commission-policy').then(v=>{if(alive)setRate(v.rate_bps===null?'':String(v.rate_bps/100));}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[]);
 async function save(){if(lock.current)return;lock.current=true;setBusy(true);setError('');setSaved('');try{await api('/admin/commission-policy','POST',{rate});setSaved('佣金比例已保存。仅影响之后领取的任务，已领取任务按原约定结算。');}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}}
 return <section className="ad-panel"><div className="ad-panel-heading"><h2>三个阶段统一佣金比例</h2></div><div style={{padding:24}}><p>领取时冻结任务金额，审核通过后返还本金并发放佣金。取消未提交任务时返还本金。</p><form className="ad-edit-form" onSubmit={e=>{e.preventDefault();void save();}}><label>佣金比例（%）<input type="number" required min="0" max="100" step="0.01" disabled={loading||busy} value={rate} onChange={e=>setRate(e.target.value)}/></label><p>佣金 = 任务金额 × 比例，按美分四舍五入。{rate!==''&&Number.isFinite(Number(rate))&&<>金额 {money(10000)} 的佣金为 {money(Math.round(10000*Number(rate)/100))}。</>}</p><button className="ad-button" disabled={loading||busy}>{busy?'正在保存…':'保存统一比例'}</button></form>{error&&<p role="alert" className="ad-error">{error}</p>}{saved&&<p role="status">{saved}</p>}<hr/><h3>收付款方式</h3><p>充值：核对外部实际收款与转账凭证后，人工审核入账。提现：审核通过后人工转账，登记实际出款凭证后才标记已出款。</p><a href="#tasks">配置各阶段任务金额与发布要求 →</a></div></section>;
}
