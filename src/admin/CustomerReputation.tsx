import {useEffect,useRef,useState} from 'react';
import {api} from '../api';
import {usePermission} from './PermissionContext';
import './customer-reputation.css';
export default function CustomerReputation({customerId,score,onUpdated}:{customerId:string;score:number;onUpdated:()=>Promise<void>}){
 const can=usePermission(),[editing,setEditing]=useState(false),[value,setValue]=useState(String(score)),[shown,setShown]=useState(score),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const baseline=useRef(score),key=useRef(''),lock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>setShown(score),[score]);
 useEffect(()=>{setEditing(false);setError('');setMessage('');setShown(score);},[customerId]);
 function open(){baseline.current=shown;key.current=crypto.randomUUID();setValue(String(shown));setReason('');setError('');setMessage('');setEditing(true);}
 const valid=/^(?:0|[1-9]\d{0,2})$/.test(value)&&Number(value)<=100;
 async function save(){if(lock.current||!valid)return;lock.current=true;setBusy(true);setError('');try{const result=await api<{score:number}>('/admin/accounts/'+encodeURIComponent(customerId)+'/reputation','POST',{score:Number(value),expectedScore:baseline.current,reason,operationKey:key.current});if(!alive.current)return;setShown(result.score);setEditing(false);setMessage('信誉分已更新为 '+result.score);try{await onUpdated();}catch{if(alive.current)setError('已保存，请刷新客户资料查看最新记录。');}}catch(e){if(alive.current)setError((e as Error).message);}finally{lock.current=false;if(alive.current)setBusy(false);}}
 return <section className="ad-reputation" aria-label="客户信誉分"><div className="ad-reputation-line"><span>信誉分</span><strong>{shown}</strong>{can('customerEdit')&&!editing&&<button type="button" className="ad-button secondary small" onClick={open}>调整</button>}</div>{editing&&<form className="ad-reputation-editor" onSubmit={e=>{e.preventDefault();void save();}}><label><span className="ad-reputation-label">信誉分 <small>0–100</small></span><input aria-label="设置信誉分" type="number" inputMode="numeric" min={0} max={100} step={1} required disabled={busy} value={value} onChange={e=>{setValue(e.target.value);key.current=crypto.randomUUID();}}/></label><label>备注（选填）<input aria-label="信誉分调整备注" maxLength={200} disabled={busy} value={reason} onChange={e=>{setReason(e.target.value);key.current=crypto.randomUUID();}} placeholder="填写调整原因"/></label><button type="submit" className="ad-button small" disabled={busy||!valid||Number(value)===baseline.current}>{busy?'保存中…':'保存'}</button><button type="button" className="ad-button secondary small" disabled={busy} onClick={()=>{setEditing(false);setError('');}}>取消</button></form>}{error&&<p className="ad-error" role="alert">{error}</p>}{message&&<p className="ad-reputation-message" role="status">{message}</p>}</section>;
}
