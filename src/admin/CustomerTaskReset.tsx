import {useState} from 'react';
import {api,money} from '../api';
import {Modal} from './components';

type Preview={token:string;batch:number;completed:number;refund:number;canReset:boolean};

export default function CustomerTaskReset({customerId,onReset}:{customerId:string;onReset:()=>void}){
 const [open,setOpen]=useState(false),[preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const path='/admin/customers/'+encodeURIComponent(customerId)+'/task-reset';
 async function inspect(){
  setOpen(true);setBusy(true);setError('');setPreview(null);setMessage('');
  try{setPreview(await api<Preview>(path));}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function reset(){
  if(!preview?.canReset||busy)return;
  setBusy(true);setError('');
  try{
   const result=await api<{refund:number}>(path,'POST',{token:preview.token});
   setOpen(false);setMessage('任务进度已重置，退回 '+money(result.refund));onReset();
  }catch(e){setPreview(null);setError((e as Error).message);}finally{setBusy(false);}
 }
 return <div className="ad-row-actions">
  <button className="ad-button secondary small" onClick={()=>void inspect()}>重置任务进度</button>
  {message&&<span role="status">{message}</span>}
  {open&&<Modal title="重置任务进度" description="当前轮从第 1 项重新开始，已结算记录和佣金保留。" onClose={()=>{if(!busy)setOpen(false);}}>
   {preview&&<p>第 {preview.batch} 轮 · 已完成 {preview.completed} 项 · 退回可用余额 {money(preview.refund)}</p>}
   {preview&&!preview.canReset&&<p>当前没有可重置的任务。</p>}
   {error&&<p role="alert" className="ad-error">{error}</p>}
   <button className="ad-button" disabled={busy||(!preview?.canReset&&!error)} onClick={()=>void (error?inspect():reset())}>{busy?'处理中…':error?'重新预览':'确认重置'}</button>
  </Modal>}
 </div>;
}
