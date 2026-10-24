import {useCallback,useEffect,useRef,useState} from 'react';
import {CheckCircledIcon,CheckIcon,CardStackIcon,ReaderIcon,ReloadIcon} from '@radix-ui/react-icons';
import {api,date,type Notice} from '../api';
import {NotificationIcon} from '../Brand';
import './notifications.css';

type Page={notifications:Notice[];nextCursor:number|null;unreadCount:number};
export default function Notifications({onOpen,onCountChange}:{onOpen:(notice:Notice)=>void;onCountChange:(count:number)=>void}){
 const [items,setItems]=useState<Notice[]>([]),[unreadOnly,setUnreadOnly]=useState(false),[unreadCount,setUnreadCount]=useState(0),[nextCursor,setNextCursor]=useState<number|null>(null),[loading,setLoading]=useState(true),[moreLoading,setMoreLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const alive=useRef(true),version=useRef(0),lock=useRef(false),countChange=useRef(onCountChange);
 countChange.current=onCountChange;
 const load=useCallback(async(append=false,before?:number)=>{
  const request=++version.current;if(append)setMoreLoading(true);else setLoading(true);
  try{const value=await api<Page>('/notifications?limit=20'+(unreadOnly?'&unread=1':'')+(before?'&before='+before:''));if(!alive.current||request!==version.current)return;
   setItems(old=>append?[...old,...value.notifications.filter(n=>!old.some(o=>o.id===n.id))]:value.notifications);setNextCursor(value.nextCursor);setUnreadCount(value.unreadCount);countChange.current(value.unreadCount);setError('');
  }catch(e){if(alive.current&&request===version.current)setError((e as Error).message);}finally{if(alive.current&&request===version.current){setLoading(false);setMoreLoading(false);}}
 },[unreadOnly]);
 useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;version.current++;};},[load]);
 async function read(notice?:Notice){if(lock.current)return;lock.current=true;version.current++;setLoading(false);setMoreLoading(false);setBusy(true);setError('');try{
   if(!notice||!notice.is_read){await api('/notifications/'+(notice?notice.id+'/':'')+'read','POST',{});if(!alive.current)return;setItems(old=>notice?old.map(n=>n.id===notice.id?{...n,is_read:1}:n):old.map(n=>({...n,is_read:1})));const count=notice?Math.max(0,unreadCount-1):0;setUnreadCount(count);countChange.current(count);}
   if(notice)onOpen(notice);else await load();
  }catch(e){if(alive.current)setError((e as Error).message);}finally{lock.current=false;if(alive.current)setBusy(false);}}
 const visible=unreadOnly?items.filter(n=>!n.is_read):items;
 return <section className="notification-center" aria-label="通知中心"><div className="s-workbench-heading"><span className="s-kicker">YOUR INBOX</span><h2>每一份进展，都有回音</h2><p>任务、资金与审核消息，按账号独立记录。</p></div><div className="notification-tabs" role="group" aria-label="消息筛选"><button aria-pressed={!unreadOnly} disabled={busy||moreLoading} onClick={()=>setUnreadOnly(false)}>全部</button><button aria-pressed={unreadOnly} disabled={busy||moreLoading} onClick={()=>setUnreadOnly(true)}>未读{unreadCount?'（'+unreadCount+'）':''}</button></div><div className="notification-toolbar"><span>{unreadCount} 条未读消息</span><div><button disabled={loading||moreLoading||busy} aria-label="刷新通知" onClick={()=>void load()}><ReloadIcon/></button><button disabled={busy||!unreadCount} onClick={()=>void read()}>全部已读 <CheckIcon/></button></div></div>{error&&<div role="alert" className="notification-error"><p>{error}</p><button disabled={loading||busy} onClick={()=>void load()}>重新读取</button></div>}{loading?<p role="status" className="notification-loading">正在读取通知…</p>:<>{visible.map(n=><button key={n.id} disabled={busy} className={'s-notice-card '+(!n.is_read?'unread':'')} onClick={()=>void read(n)}><span>{n.category==='finance'?<CardStackIcon/>:n.category==='stage'||n.assignment_id||n.task_id?<ReaderIcon/>:<NotificationIcon/>}</span><div><h3>{n.title}{!n.is_read&&<i aria-label="未读"/>}</h3><p>{n.body}</p><small>{date(n.created_at,true)}</small></div></button>)}{!visible.length&&!error&&<div className="notification-empty"><CheckCircledIcon/><h3>{unreadOnly?'未读消息已处理完':'暂时没有消息'}</h3><p>新的任务、资金与审核进展会显示在这里。</p></div>}{nextCursor&&<button className="notification-more" disabled={moreLoading||busy} onClick={()=>void load(true,nextCursor)}>{moreLoading?'正在读取…':'加载更早消息'}</button>}</>}</section>;
}
