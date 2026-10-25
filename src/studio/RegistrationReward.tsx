import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {CheckIcon,Cross2Icon,ArrowRightIcon} from '@radix-ui/react-icons';
import {BrandMark} from '../Brand';
import {money} from '../api';
import './registration-reward.css';
export default function RegistrationReward({amount,onClose,onStart}:{amount:number;onClose:()=>void;onStart:()=>void}){
 const dialog=useRef<HTMLDivElement>(null),primary=useRef<HTMLButtonElement>(null),close=useRef<HTMLButtonElement>(null);
 const reduced=useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const [shown,setShown]=useState(reduced.current?amount:0),[ready,setReady]=useState(reduced.current);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';close.current?.focus();
  let frame=0;const began=performance.now();
  if(!reduced.current){const animate=(now:number)=>{const elapsed=now-began,progress=Math.min(1,Math.max(0,(elapsed-850)/1400));setShown(Math.round(amount*(1-Math.pow(1-progress,3))));if(elapsed<2600)frame=requestAnimationFrame(animate);else setReady(true);};frame=requestAnimationFrame(animate);}
  return()=>{cancelAnimationFrame(frame);document.body.style.overflow=overflow;previous?.focus();};
 },[amount]);
 return createPortal(<div lang="en" className={'registration-reward'+(ready?' is-ready':' is-intro')} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();onClose();}if(e.key==='Tab'){const buttons=dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');if(!buttons?.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}}>
  <img className="registration-character" src="/art/welcome-guide-v2.webp" alt="" aria-hidden="true" fetchPriority="high"/><div className="registration-scene-shade" aria-hidden="true"/><div className="registration-scan" aria-hidden="true"/>
  <div className="registration-confetti" aria-hidden="true">{Array.from({length:20},(_,i)=><i key={i} style={{'--i':i} as React.CSSProperties}/>)}</div>
  <div ref={dialog} className="registration-award" role="dialog" aria-modal="true" aria-labelledby="registration-reward-title" aria-describedby="registration-reward-description">
   <button ref={close} className="registration-close" aria-label="Skip welcome animation" onClick={onClose}><Cross2Icon/></button>
   <div className="registration-brand"><BrandMark/><span>STUDIO</span></div>
   <span className="registration-eyebrow">YOUR STORY STARTS HERE</span>
   <h2 id="registration-reward-title">Welcome aboard.</h2>
   <p id="registration-reward-description">Registration complete.<br/>A little welcome. A new beginning.</p>
   <div className="registration-amount"><span>YOUR WELCOME REWARD</span><strong aria-label={money(amount)}><span aria-hidden="true">{money(shown)}</span></strong><small aria-live="polite">{ready?<><CheckIcon/>Added to your available balance</>:<>Revealing your welcome reward</>}</small></div>
   <p className="registration-note">Already in your wallet. No claim needed.<br/>A one-time reward for your new account.</p>
   <button ref={primary} className="registration-start" disabled={!ready} onClick={onStart}>Start creating<ArrowRightIcon/></button>
   <button className="registration-home" onClick={onClose}>{ready?'Explore the studio':'Skip intro'}</button>
  </div>
 </div>,document.body);
}
