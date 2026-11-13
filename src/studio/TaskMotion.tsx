import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {translateText as tx} from '../i18n/translate';
import type {Task} from '../api';
import {amountNumber} from './task-display';
export type MotionEvent={task:Task;kind:'reveal'|'settled'};
export default function TaskMotion({event,onClose}:{event:MotionEvent|null;onClose:()=>void}){
 const toast=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!event||!toast.current||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const a=toast.current.animate([{opacity:0,transform:'translate(-50%,-8px)'},{opacity:1,transform:'translate(-50%,0)'}],{duration:200,easing:'ease-out'});return()=>a.cancel();},[event]);
 const close=useRef(onClose);close.current=onClose;
 useEffect(()=>{if(!event)return;const timer=setTimeout(()=>close.current(),1100);return()=>clearTimeout(timer);},[event]);
 if(!event)return null;
 const settled=event.kind==='settled';
 return createPortal(<div className="task-experience task-experience-overlay"><div ref={toast} className={'task-feedback-toast'+(event.task.premium?' premium':'')} role="status"><span className="task-feedback-mark" aria-hidden="true">{settled?'✓':'✦'}</span><div><strong>{tx(settled?'结算成功':event.task.premium?'高阶作品已领取':'作品已领取')}</strong><span>{settled?'+'+amountNumber(event.task.commission):event.task.title}</span></div><button type="button" onClick={onClose} aria-label={tx('关闭')}>×</button></div></div>,document.body);
}
