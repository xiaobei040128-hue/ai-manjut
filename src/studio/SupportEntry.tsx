import {useEffect,useRef,useState,type ReactNode} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {BrandMark} from '../Brand';
import {translateText as tx} from '../i18n/translate';
import './support-entry.css';
// Check if we should open in modal (preserve state) instead of new tab
function shouldUseModal(element?:Element):boolean{
  if(typeof window==='undefined')return false;
  if(window.location.search.includes('finance=deposit'))return true;
  const target=element||document.activeElement;
  if(target&&target.closest('.bottom-sheet'))return true;
  return document.body.style.overflow==='hidden';
}
export default function SupportEntry({href,children,className,label,forceModal}:{href:string;children:ReactNode;className?:string;label?:string;forceModal?:boolean}){
 const [open,setOpen]=useState(false),trigger=useRef<HTMLAnchorElement>(null),frame=useRef<HTMLIFrameElement>(null);
  const embedded=(()=>{try{const u=new URL(href);return u.protocol==='https:'&&['chat.aicreatorai.com','app.linechatai.com'].includes(u.hostname)&&u.pathname.startsWith('/c/');}catch{return false;}})();
  const [inSheet,setInSheet]=useState(shouldUseModal);
  useEffect(()=>{if(embedded||forceModal)return;const check=()=>setInSheet(shouldUseModal(trigger.current||undefined));check();const observer=new MutationObserver(check);observer.observe(document.body,{attributes:true,attributeFilter:['style']});document.addEventListener('focusin',check);return()=>{observer.disconnect();document.removeEventListener('focusin',check);};},[embedded,forceModal]);
  const useModal=embedded||forceModal||inSheet;
  useEffect(()=>{
   if(!open)return;
   const pop=()=>setOpen(false);
   window.addEventListener('popstate',pop);
   return()=>window.removeEventListener('popstate',pop);
  },[open]);
  useEffect(()=>{
   if(!open)return;
   const origin=new URL(href).origin;
   const layout=(event:MessageEvent)=>{
    if(event.source!==frame.current?.contentWindow||event.origin!==origin)return;
    const data=event.data;
    if(data?.type==='salewisely-resize'&&typeof data.isOpen==='boolean')event.source?.postMessage({type:data.type,isOpen:data.isOpen},{targetOrigin:origin});
    if(data?.type==='salewisely-frame-shadow'&&typeof data.open==='boolean')event.source?.postMessage({type:data.type,open:data.open},{targetOrigin:origin});
   };
   window.addEventListener('message',layout);return()=>window.removeEventListener('message',layout);
  },[open,href]);
  const close=()=>{if(history.state?.supportPanel)history.back();else setOpen(false);};
   return <><a ref={trigger} href={href} className={className} aria-label={label} target={useModal?'':'_blank'} rel="noopener noreferrer" onMouseDown={(e)=>{const m=embedded||forceModal||shouldUseModal();if(trigger.current)trigger.current.target=m?'':'_blank';if(m){e.preventDefault();e.stopPropagation();}}} onClick={e=>{const modal=embedded||forceModal||shouldUseModal();if(!modal||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0)return;e.preventDefault();e.stopPropagation();history.pushState({...history.state,supportPanel:true},'',location.href);setOpen(true);}}>{children}</a>
  <Dialog.Root open={open} onOpenChange={value=>{if(!value)close();}}><Dialog.Portal><Dialog.Content className="platform-support-panel" aria-describedby={undefined} onCloseAutoFocus={e=>{e.preventDefault();trigger.current?.focus();}}><Dialog.Title style={{position:"absolute",width:1,height:1,overflow:"hidden",clipPath:"inset(50%)",whiteSpace:"nowrap"}}>{tx('在线客服')}</Dialog.Title>
   <header><button type="button" autoFocus onClick={close}>‹ {tx('返回')}</button><div><BrandMark/><strong>AI CREATOR</strong><span>{tx('在线客服')}</span></div></header>
   <iframe ref={frame} src={href} title={tx('在线客服')} referrerPolicy="no-referrer" allow="microphone; clipboard-write"/>
  </Dialog.Content></Dialog.Portal></Dialog.Root></>;
}
