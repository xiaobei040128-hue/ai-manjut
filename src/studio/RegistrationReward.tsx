import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {CheckIcon,Cross2Icon,ArrowRightIcon} from '@radix-ui/react-icons';
import {money} from '../api';
import {playWelcomeChime,welcomeAudioReady} from './welcome-audio';
import './registration-reward.css';
const REVEAL_MS=1700,READY_MS=2850;
export default function RegistrationReward({amount,onClose,onStart}:{amount:number;onClose:()=>void;onStart:()=>void}){
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
 return createPortal(<div lang="en" className={'registration-reward'+(ready?' is-ready':' is-intro')} onKeyDown={e=>{
  if(e.key==='Escape'){e.preventDefault();onClose();}
  if(e.key==='Tab'){const buttons=dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');if(!buttons?.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
 }}>
  <div ref={dialog} className="registration-award" role="dialog" aria-modal="true" aria-labelledby="registration-reward-title" aria-describedby="registration-reward-description">
   <div className="registration-hero">
    <img className="registration-character" src="/art/welcome-guide-v3.webp" alt="" aria-hidden="true" fetchPriority="high"/>
    <div className="registration-scene-shade" aria-hidden="true"/>
    <button ref={close} className="registration-close" aria-label="Skip welcome animation" onClick={onClose}><Cross2Icon/></button>
   </div>
   <div className="registration-copy">
    <span className="registration-eyebrow"><CheckIcon/>REGISTRATION COMPLETE</span>
    <h2 id="registration-reward-title">Welcome <em>aboard.</em></h2>
    <p id="registration-reward-description">Your first chapter starts here.</p>
    <div className="registration-amount">
     <div className="registration-gift-label"><span>YOUR WELCOME GIFT</span></div>
     <strong aria-label={money(amount)}><span aria-hidden="true">{money(shown)}</span></strong>
     <div className="registration-credit" aria-live="polite">{ready?<><CheckIcon/>Added to your available balance</>:<>Revealing your welcome reward</>}</div>
    </div>
    <button className="registration-start" disabled={!ready} onClick={onStart}>Start creating<ArrowRightIcon/></button>
    <div className="registration-tools">
     <button className="registration-home" onClick={onClose}>{ready?'Explore the studio':'Skip intro'}</button>
    </div>
   </div>
  </div>
 </div>,document.body);
}
