import {useState} from 'react';
import {api} from '../api';
import {Modal} from './components';
export default function DeleteAgent({agent,onClose,onDeleted}:{agent:{id:string;username:string;customers:number};onClose:()=>void;onDeleted:()=>Promise<void>}){
 const [confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <Modal title="删除代理后台账号" description={agent.username} onClose={()=>{if(!busy)onClose();}}><form className="ad-edit-form" onSubmit={async e=>{e.preventDefault();if(busy||confirmation!==agent.username)return;setBusy(true);setError('');try{await api('/admin/agents/'+agent.id,'DELETE',{confirmUsername:confirmation});await onDeleted();onClose();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
 <p>删除后该代理不能再登录，已有邀请码停止接受注册。其 {agent.customers} 位客户、订单和资金记录保留，总后台仍可管理。</p><p>此操作不能通过“启用”恢复，原账号名称保留用于历史记录。</p>
 <label>输入代理账号确认<input autoComplete="off" disabled={busy} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>
 {error&&<p role="alert" className="ad-error">{error}</p>}<button className="ad-button" disabled={busy||confirmation!==agent.username}>{busy?'删除中…':'确认删除代理账号'}</button></form></Modal>;
}
