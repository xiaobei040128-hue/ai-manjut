import {useCallback,useEffect,useRef,useState} from 'react';
import {api,money,date} from '../api';
import {Empty} from './components';
import './customer-history.css';
type Row={id:string|number;status?:string;created_at:string;task?:{title:string;deposit:number;commission:number};note?:string;amount?:number;balance_after?:number};
type Page={items:Row[];total:number;nextCursor:string|null;page:number;cursor:string|null};
const statuses:Record<string,string>={completed:'已完成',active:'进行中',review:'审核中',revision:'待修改',cancelled:'已取消'};
export default function CustomerHistory({customerId,kind}:{customerId:string;kind:'records'|'ledger'}){
 const [positions,setPositions]=useState<(string|null)[]>([null]),[data,setData]=useState<Page|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const ticket=useRef(0),pending=useRef<number|null>(null),alive=useRef(true),signature=useRef(''),cursor=positions.at(-1)!,page=positions.length;
 const load=useCallback(async(quiet=false)=>{
  if(pending.current!==null){if(!quiet)setLoading(true);return;}const request=++ticket.current;pending.current=request;if(!quiet)setLoading(true);
  try{const result=await api<Omit<Page,'page'|'cursor'>>('/admin/customers/'+encodeURIComponent(customerId)+'/'+kind+(cursor?'?cursor='+encodeURIComponent(cursor):''));if(!alive.current||request!==ticket.current)return;const next={...result,page,cursor},encoded=JSON.stringify(next);if(signature.current!==encoded){signature.current=encoded;setData(next);}setError('');}
  catch(e){if(alive.current&&request===ticket.current)setError((e as Error).message);}
  finally{if(pending.current===request)pending.current=null;if(alive.current&&request===ticket.current)setLoading(false);}
 },[customerId,kind,cursor,page]);
 useEffect(()=>{alive.current=true;void load();const refresh=()=>{if(!document.hidden)void load(true);};const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);return()=>{alive.current=false;ticket.current++;pending.current=null;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);};},[load]);
 function move(next:boolean){if(loading)return;if(pending.current!==null){ticket.current++;pending.current=null;}setLoading(true);setError('');setPositions(old=>next&&data?.nextCursor?[...old,data.nextCursor]:old.length>1?old.slice(0,-1):old);}
 const records=kind==='records',title=records?'客户任务记录':'此客户的资金流水';
 return <section className="ad-panel customer-history" aria-label={title} aria-busy={loading}><div className="ad-panel-heading"><div><h2>{title}</h2><span className="ad-muted">{data?'共 '+data.total+' 条':'正在读取…'}</span></div><button className="ad-button secondary small" disabled={loading} onClick={()=>void load()}>刷新记录</button></div>
 {error&&<p className="ad-error" role="alert">{error}</p>}<div className="ad-table-scroll"><table><thead><tr>{(records?['作品','状态','版权金额','佣金','时间']:['时间','说明','变动','变动后余额']).map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{data?.items.map(row=><tr key={row.id}>{records?<><td>{row.task!.title}</td><td>{statuses[row.status!]||row.status}</td><td>{money(row.task!.deposit)}</td><td>{money(row.task!.commission)}</td><td>{date(row.created_at,true)}</td></>:<><td>{date(row.created_at,true)}</td><td>{row.note}</td><td className={row.amount!>0?'customer-credit':''}>{row.amount!>0?'+':''}{money(row.amount!)}</td><td>{money(row.balance_after!)}</td></>}</tr>)}</tbody></table></div>
 {!loading&&!error&&!data?.items.length&&<Empty title={records?'暂无版权领取记录':'暂无流水'} text={records?'客户开始任务后，记录会显示在这里。':'资金变化后会在这里记录。'}/>}
 <div className="customer-history-pagination"><span role="status">{loading?'正在读取…':'第 '+(data?.page||page)+' 页 · 每页25条'}</span><div><button className="ad-button secondary small" disabled={loading||page<=1} onClick={()=>move(false)}>上一页</button><button className="ad-button secondary small" disabled={loading||!!error||data?.cursor!==cursor||!data?.nextCursor} onClick={()=>move(true)}>下一页</button></div></div></section>;
}
