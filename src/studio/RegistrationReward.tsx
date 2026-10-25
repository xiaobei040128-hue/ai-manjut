import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {CheckIcon,Cross2Icon,ArrowRightIcon,ReloadIcon} from '@radix-ui/react-icons';
import {BrandMark} from '../Brand';
import {money} from '../api';
import './registration-reward.css';
export default function RegistrationReward({amount,onClose,onStart}:{amount:number;onClose:()=>void;onStart:()=>void}){
 const dialog=useRef<HTMLDivElement>(null),primary=useRef<HTMLButtonElement>(null),close=useRef<HTMLButtonElement>(null);
 const reduced=useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const [take,setTake]=useState(0);
 const [shown,setShown]=useState(reduced.current?amount:0),[ready,setReady]=useState(reduced.current);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';close.current?.focus();
  return()=>{document.body.style.overflow=overflow;previous?.focus();};
 },[]);
 useEffect(()=>{
  setShown(reduced.current?amount:0);setReady(reduced.current);close.current?.focus();
  let frame=0;const began=performance.now();
  if(!reduced.current){const animate=(now:number)=>{const elapsed=now-began,progress=Math.min(1,Math.max(0,(elapsed-1850)/1100));setShown(Math.round(amount*(1-Math.pow(1-progress,3))));if(elapsed<3400)frame=requestAnimationFrame(animate);else setReady(true);};frame=requestAnimationFrame(animate);}
  return()=>cancelAnimationFrame(frame);
 },[amount,take]);
 return createPortal(<div lang="en" className={'registration-reward'+(ready?' is-ready':' is-intro')} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();onClose();}if(e.key==='Tab'){const buttons=dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');if(!buttons?.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}}>
  <div key={take} ref={dialog} className="registration-award" role="dialog" aria-modal="true" aria-labelledby="registration-reward-title" aria-describedby="registration-reward-description">
   <div className="registration-hero">
    <div className="registration-atmosphere" aria-hidden="true"/><img className="registration-character" src="/art/welcome-guide-v3.webp" alt="" aria-hidden="true" fetchPriority="high"/>
    <div className="registration-scene-shade" aria-hidden="true"/><div className="registration-lens" aria-hidden="true"/>
    <span className="registration-scene-caption" aria-hidden="true">A NEW CHAPTER BEGINS</span>
    <button ref={close} className="registration-close" aria-label="Skip welcome animation" onClick={onClose}><Cross2Icon/></button>
    <div className="registration-brand"><BrandMark/><span>STUDIO</span></div>
   </div>
   <div className="registration-copy">
   <span className="registration-eyebrow">YOUR STORY STARTS HERE</span>
   <h2 id="registration-reward-title">Welcome aboard.</h2>
   <p id="registration-reward-description">Registration complete. Your story starts now.</p>
   <div className="registration-amount"><span>YOUR WELCOME REWARD</span><strong aria-label={money(amount)}><span aria-hidden="true">{money(shown)}</span></strong><small aria-live="polite">{ready?<><CheckIcon/>Added to your available balance</>:<>Revealing your welcome reward</>}</small></div>
   <p className="registration-note">A one-time welcome, already in your wallet.</p>
   <button ref={primary} className="registration-start" disabled={!ready} onClick={onStart}>Start creating<ArrowRightIcon/></button>
   <button className="registration-replay" onClick={()=>setTake(v=>v+1)}><ReloadIcon/>Replay welcome</button>
   <button className="registration-home" onClick={onClose}>{ready?'Explore the studio':'Skip intro'}</button>
   </div>
  </div>
 </div>,document.body);
}
