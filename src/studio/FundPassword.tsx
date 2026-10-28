import {translateText as tx,localizeNode as lx} from "../i18n/translate";
import {useState, useEffect, useRef, useCallback, type FormEvent} from 'react';
import {LockClosedIcon, ChevronRightIcon, Cross2Icon} from '@radix-ui/react-icons';
import {BottomSheet, KeyboardInput, useKeyboard} from '../mobile';
import {api} from '../api';
const emptyForm = {loginPassword:'', currentPassword:'', newPassword:'', confirmPassword:''};
export default function FundPassword(){
 const [configured,setConfigured]=useState<boolean|null>(null),[open,setOpen]=useState(false),[form,setForm]=useState(emptyForm),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const lock=useRef(false),live=useRef(true),keyboard=useKeyboard();
 const read=useCallback(async()=>{try{const state=await api<{configured:boolean}>('/auth/fund-password');if(live.current){setConfigured(state.configured);setError('');}}catch{if(live.current)setError('暂时无法读取资金密码状态，请重试');}},[]);
 useEffect(()=>{live.current=true;void read();return()=>{live.current=false;};},[read]);
 useEffect(()=>{if(configured===null)return;const query=new URLSearchParams(location.search);if(query.get('security')==='fund'){query.delete('security');history.replaceState(null,'','/?'+query);setOpen(true);}},[configured]);
 function close(){if(lock.current)return;keyboard.hide();setOpen(false);setForm(emptyForm);setError('');}
 async function submit(e:FormEvent){
  e.preventDefault();if(lock.current)return;
  if(form.newPassword!==form.confirmPassword){setError('两次输入的资金密码不一致');return;}
  lock.current=true;setBusy(true);setError('');
  try{await api('/auth/fund-password','POST',form);if(live.current){setConfigured(true);setNotice('资金密码已保存');lock.current=false;close();}}
  catch(e){if(live.current)setError((e as Error).message);}
  finally{lock.current=false;if(live.current)setBusy(false);}
 }
 const fields: [keyof typeof form,string][]=[configured?['currentPassword','原资金密码']:['loginPassword','登录密码'],['newPassword','新资金密码'],['confirmPassword','确认资金密码']];
 return <>
  <button className="profile-password-row" onClick={()=>{if(configured===null){void read();return;}setOpen(true);setNotice('');}}>
   <LockClosedIcon/><span><b>{tx("资金密码")}</b><small>{lx(configured===null?(error?'读取失败 · 点击重试':'读取中'):configured?'已设置 · 提款时验证':'未设置 · 提款前需设置')}</small></span><em>{lx(configured===null?'重试':configured?'修改':'设置')}</em><ChevronRightIcon/>
  </button>
  {lx(notice&&<p className="fund-password-notice" role="status">{lx(notice)}</p>)}{lx(error&&!open&&<p className="fund-password-error" role="alert">{lx(error)}</p>)}
  <BottomSheet open={open} onOpenChange={v=>{if(!v)close();}} title={tx(configured?'修改资金密码':'设置资金密码')} description={tx("资金密码用于确认提款，请与登录密码分开设置。")}>
   <form className="profile-password-form" onSubmit={submit}>
    <button type="button" className="profile-password-close" aria-label={tx("关闭资金密码")} onClick={close} disabled={busy}><Cross2Icon/></button>
    {lx(fields.map(([key,label])=><label key={key}>{lx(label)}<KeyboardInput required type="password" autoComplete={key==='loginPassword'?'current-password':key==='currentPassword'?'off':'new-password'} minLength={key==='newPassword'||key==='confirmPassword'?8:undefined} maxLength={128} disabled={busy} value={form[key]} onChange={e=>setForm(v=>({...v,[key]:e.target.value}))}/></label>))}
    {lx(error&&<p role="alert">{lx(error)}</p>)}<button className="profile-password-submit" disabled={busy||!form[fields[0][0]]||form.newPassword.length<8||!form.confirmPassword}>{lx(busy?'正在保存…':'确认保存')}</button>
   </form>
  </BottomSheet>
 </>;
}
