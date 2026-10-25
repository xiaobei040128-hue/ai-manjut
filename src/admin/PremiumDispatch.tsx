import {useEffect,useRef,useState} from 'react';
import {api,date} from '../api';
import {Empty,Modal,Pagination} from './components';
type Customer={id:string;email:string;name:string;sequences:number[];revision:number;claimedThrough:number;updated_by:string|null;updated_at:string|null};
type Configuration={day:string;customers:Customer[]};
type Edit=Customer&{day:string};
export default function PremiumDispatch(){
 const [rows,setRows]=useState<Customer[]>([]),[day,setDay]=useState(''),[query,setQuery]=useState(''),[page,setPage]=useState(1),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState(''),[target,setTarget]=useState<Edit|null>(null),[selected,setSelected]=useState<number[]>([]),[busy,setBusy]=useState(false);
 const lock=useRef(false),version=useRef(0),alive=useRef(true);
 async function load(replaceEdit=false){
  const current=++version.current;setLoading(true);setError('');
  try{
   const data=await api<Configuration>('/admin/premium-dispatch');
   if(!alive.current||current!==version.current)return;
   setDay(data.day);setRows(data.customers);
   if(replaceEdit&&target){const customer=data.customers.find(c=>c.id===target.id);if(customer){setTarget({...customer,day:data.day});setSelected([...customer.sequences]);}else setTarget(null);}
  }catch(e){if(alive.current&&current===version.current)setError((e as Error).message);}
  finally{if(alive.current&&current===version.current)setLoading(false);}
 }
 useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;version.current++;};},[]);
 async function save(){
  if(!target||lock.current)return;lock.current=true;setBusy(true);setError('');setMessage('');
  const edit=target;
  try{
   const saved=await api<{day:string;sequences:number[];revision:number;claimedThrough:number;updated_by:string;updated_at:string}>('/admin/premium-dispatch/'+edit.id,'POST',{day:edit.day,sequences:selected,revision:edit.revision});
   if(!alive.current)return;
   version.current++;setLoading(false);
   setRows(old=>old.map(r=>r.id===edit.id&&day===saved.day?{...r,...saved}:r));
   setTarget(null);setMessage('已保存此客户今日触发位置，其他客户不受影响。');
  }catch(e){if(alive.current)setError((e as Error).message);}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 const visible=rows.filter(r=>`${r.email} ${r.name}`.toLowerCase().includes(query.toLowerCase()));
 const currentPage=Math.min(page,Math.max(1,Math.ceil(visible.length/10)));
 return <section className="ad-panel">
  <div className="ad-panel-heading"><div><h2>客户高阶任务派发</h2><p>北京时间 {day||'读取中'} · 按客户当天成功领取的第三阶段任务计数，可设置多个触发序号。未设置不触发。</p></div></div>
  <div className="ad-toolbar"><input aria-label="搜索高阶配置客户" placeholder="客户邮箱或姓名" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/><button className="ad-button secondary" disabled={busy||loading} onClick={()=>void load()}>{loading?'读取中…':'刷新配置'}</button></div>
  {error&&<p role="alert" className="ad-error">{error}</p>}{message&&<p role="status" className="ad-callout">{message}</p>}
  <div className="ad-table-scroll"><table><thead><tr><th>客户</th><th>今日高阶触发</th><th>已领取至</th><th>更新记录</th><th>操作</th></tr></thead><tbody>{visible.slice((currentPage-1)*10,currentPage*10).map(r=><tr key={r.id}><td><b>{r.name}</b><br/>{r.email}</td><td>{r.sequences.length?r.sequences.map(n=>'第 '+n+' 单').join('、'):'未设置 · 不触发'}</td><td>第 {r.claimedThrough} 单</td><td>{r.updated_by||'—'}{r.updated_at&&<small>{date(r.updated_at,true)}</small>}</td><td><button className="ad-button small" disabled={busy||loading} onClick={()=>{setTarget({...r,day});setSelected([...r.sequences]);setError('');setMessage('');}}>设置触发序号</button></td></tr>)}</tbody></table></div>
  {!visible.length&&!loading&&<Empty title={query?'没有匹配客户':'暂无客户'} text={query?'调整邮箱或姓名后重新搜索。':'客户注册后，可在这里单独配置触发序号。'}/>}
  <Pagination page={currentPage} total={visible.length} onChange={setPage}/>
  {target&&<Modal title="客户高阶任务触发配置" description={target.email+' · '+target.day} onClose={()=>!busy&&setTarget(null)}><form className="ad-edit-form ad-dispatch-form" onSubmit={e=>{e.preventDefault();void save();}}><p>仅设置当前客户。勾选的序号为高阶任务，其余为标准任务；已经领取的位置锁定。</p><fieldset disabled={busy||loading} style={{border:'1px solid #e8e1f1',borderRadius:14,padding:16}}><legend>今日触发序号（可多选）</legend><div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:12}}>{Array.from({length:20},(_,i)=>i+1).map(n=><label key={n} style={{display:'flex',gap:6,alignItems:'center',fontSize:12}}><input type="checkbox" style={{width:16,minHeight:16,margin:0}} aria-label={'第 '+n+' 单'} disabled={n<=target.claimedThrough} checked={selected.includes(n)} onChange={e=>setSelected(old=>e.target.checked?[...old,n]:old.filter(x=>x!==n))}/>第 {n} 单</label>)}</div></fieldset><button type="button" className="ad-button secondary" disabled={busy||loading} onClick={()=>setSelected(target.sequences.filter(n=>n<=target.claimedThrough))}>关闭所有未触发位置</button><p>取消后重新领取计为新一单；重复请求与领取失败不计数。作品按五天计划分批开放，未完成的批次保留；此处可配置当日前20次领取的触发位置，次日配置默认关闭。金额与佣金按任务及统一比例结算。</p>{error&&<><p role="alert" className="ad-error">{error}</p><button type="button" className="ad-button secondary" disabled={busy||loading} onClick={()=>void load(true)}>重新读取配置（覆盖未保存选择）</button></>}<button className="ad-button" disabled={busy||loading}>{busy?'保存中…':'保存当前客户配置'}</button></form></Modal>}
 </section>;
}
