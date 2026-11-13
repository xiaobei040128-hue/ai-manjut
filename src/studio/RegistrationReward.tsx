import {useLanguage} from '../i18n/language';
import {translateText as tx,localizeNode as lx} from "../i18n/translate";
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {CheckIcon,Cross2Icon,ArrowRightIcon} from '@radix-ui/react-icons';
import {money} from '../api';
import {playWelcomeChime,welcomeAudioReady} from './welcome-audio';
import './registration-reward.css';
const REVEAL_MS=1700,READY_MS=2850;
export default function RegistrationReward({amount,onClose,onStart}:{amount:number;onClose:()=>void;onStart:()=>void}){
 const language=useLanguage();
 const dialog=useRef<HTMLDivElement>(null),close=useRef<HTMLButtonElement>(null);
 const reduced=useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const stopSound=useRef<()=>void>(()=>{}),soundEnabled=useRef(welcomeAudioReady());
 const [shown,setShown]=useState(reduced.current?amount:0),[ready,setReady]=useState(reduced.current);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  return()=>{document.body.style.overflow=overflow;previous?.focus();};
 },[]);
 useEffect(()=>{
  setShown(reduced.current?amount:0);setReady(reduced.current);close.current?.focus();
  const began=performance.now();let frame=0;
  stopSound.current=soundEnabled.current?playWelcomeChime(reduced.current?0:REVEAL_MS/1000):()=>{};
  if(!reduced.current){const animate=(now:number)=>{
   const elapsed=now-began,progress=Math.min(1,Math.max(0,(elapsed-REVEAL_MS)/850));
   setShown(Math.round(amount*(1-Math.pow(1-progress,3))));
   if(elapsed<READY_MS)frame=requestAnimationFrame(animate);else setReady(true);
  };frame=requestAnimationFrame(animate);}
  const hide=()=>{if(document.hidden)stopSound.current();};
  document.addEventListener("visibilitychange",hide);
  return()=>{cancelAnimationFrame(frame);stopSound.current();document.removeEventListener("visibilitychange",hide);};
 },[amount]);
 return createPortal(<div lang={language} dir={language==='ar'?'rtl':'ltr'} className={'registration-reward'+(ready?' is-ready':' is-intro')} onKeyDown={e=>{
  if(e.key==='Escape'){e.preventDefault();onClose();}
  if(e.key==='Tab'){const buttons=dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');if(!buttons?.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
 }}>
  <div ref={dialog} className="registration-award" role="dialog" aria-modal="true" aria-labelledby="registration-reward-title" aria-describedby="registration-reward-description">
   <div className="registration-hero">
    <img className="registration-character" src="/art/profile-creator-films-r15.webp" alt="" aria-hidden="true" fetchPriority="high"/>
    <div className="registration-scene-shade" aria-hidden="true"/>
    <button ref={close} className="registration-close" aria-label={tx("关闭欢迎页")} onClick={onClose}><Cross2Icon/></button>
   </div>
   <div className="registration-copy">
    <span className="registration-eyebrow"><CheckIcon/>{tx("账号已创建")}</span>
    <h2 id="registration-reward-title">{tx("欢迎加入。")}</h2>
    <p id="registration-reward-description">{tx("你的 AI CREATOR 账号已准备就绪。")}</p>
    <div className="registration-amount">
     <div className="registration-gift-label"><span>{tx("欢迎奖励")}</span></div>
     <strong aria-label={tx(money(amount))}><span aria-hidden="true">{lx(money(shown))}</span></strong>
     <div className="registration-credit" aria-live="polite">{lx(ready?<><CheckIcon/>{tx("奖励已计入钱包")}</>:<>{tx("正在准备奖励")}</>)}</div>
    </div>
    <button className="registration-start" disabled={!ready} onClick={onClose}>{tx("进入创作空间")}<ArrowRightIcon/></button>
    <div className="registration-tools">
     <button className="registration-home" onClick={ready?onStart:onClose}>{lx(ready?'开始首个任务':'跳过动画')}</button>
    </div>
   </div>
  </div>
 </div>,document.body);
}
