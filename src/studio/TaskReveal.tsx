import {useEffect,useRef,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import type {Task} from '../api';
import {translateText as tx} from '../i18n/translate';
import {amountNumber} from './task-display';
import './task-reveal.css';

export default function TaskReveal({task,sequence,onClose}:{task:Task;sequence:number;onClose:()=>void}){
 const premium=!!task.premium;
 const duration=premium?3200:2600;
 const chapter=String(sequence).padStart(2,'0');
 const edition='CHAPTER '+chapter.padStart(3,'0');
 const cover=task.cover;
 const dialog=useRef<HTMLDialogElement>(null);
 const close=useRef(onClose);
 close.current=onClose;
 useEffect(()=>{
  const element=dialog.current;
  element?.showModal();
  const timer=setTimeout(()=>close.current(),duration);
  return()=>{clearTimeout(timer);element?.close();};
 },[duration]);
 return createPortal(<div className="task-reveal"><dialog ref={dialog} className={'motion-stage'+(premium?' premium':'')} style={{'--duration':duration+'ms'} as CSSProperties} aria-label={tx('作品动态揭晓')} onCancel={event=>{event.preventDefault();onClose();}}>
    <img className="cinema-artback" src={cover} alt="" aria-hidden="true"/>
    <div className="cinema-curtain" aria-hidden="true"></div>
    <div className="cinema-grain" aria-hidden="true"></div>
    <div className="stage-coordinate" aria-hidden="true"><span>AI CREATOR / ORIGINAL COLLECTION</span><span>{edition}</span></div>
    <div className="cinema-aura" aria-hidden="true"></div>
    <div className="cinema-rings" aria-hidden="true"><i></i><i></i><i></i></div>
    <div className="cinema-particles" aria-hidden="true">{Array.from({length:12},(_,i)=><i key={i} style={{"--x":(10+i*37%80)+"%","--y":(25+i*13%45)+"%","--delay":(i%7*.12)+"s"} as CSSProperties}/>)}</div>
    <div className="cinema-header"><span>{premium?'PREMIUM COLLECTION':'STUDIO SELECTION'}</span><i></i><small>{edition}</small></div>
    <div className="cinema-object"><div className="premium-vault" aria-hidden="true"><div className="vault-halo"></div><div className="vault-plinth"></div><div className="vault-door vault-left"><span>AI</span></div><div className="vault-door vault-right"><span>CREATOR</span></div><div className="vault-monogram">✦</div></div>
     <div className="gallery-portal" aria-hidden="true"><i></i><i></i></div>
     <div className="poster-caption" aria-hidden="true"><span>OFFICIAL SELECTION</span><b>{chapter}</b></div>
     <div className="archive-display"><div className="archive-floor"></div><img className="archive-base" src="/art/task-archive-case-runtime.webp" alt=""/><div className="archive-beam"></div></div>
     <div className="cinema-shadow"></div>
     <div className="cinema-sleeve"><div className="sleeve-rule"></div><span>AI CREATOR</span><svg viewBox="0 0 80 80"><path d="M40 6 74 40 40 74 6 40ZM40 18 62 40 40 62 18 40ZM40 6v68M6 40h68"/></svg><b>THE NEXT<br/>CHAPTER</b><small>精选作品 · 为你开启</small></div>
     <div className="cinema-poster"><div className="poster-back" aria-hidden="true"><div><span>AI CREATOR</span><svg viewBox="0 0 80 80"><path d="M40 8 72 40 40 72 8 40Z"/><path d="m40 21 19 19-19 19-19-19Z"/><path d="M40 8v64M8 40h64"/><circle cx="40" cy="40" r="7"/></svg><b>THE NEXT<br/>CHAPTER</b><i>✦</i></div></div><img src={cover} alt=""/><i className="cinema-foil"></i><div className="cinema-seal"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17"/><path d="m11 20 6 6 13-14"/></svg></div></div>
     <img className="cinema-archive-front" src="/art/task-archive-case-runtime.webp" alt=""/>
    </div>
    <div className="cinema-copy"><span className="cinema-kicker">{tx(premium?'一份特别的作品邀请':'这一份故事，属于你的下一程')}</span><h2>{task.title}</h2><div className="cinema-line"></div><p>{tx('作品已领取，准备查看本单详情')}</p></div>
    <div className="scene-terms"><div><span>{tx('版权金额')}</span><b>{amountNumber(task.deposit)}</b></div><div><span>{tx('完成佣金')}</span><b>{'+'+amountNumber(task.commission)}</b></div></div>
    <button className="cinema-continue" type="button" onClick={onClose}>{tx('查看本次作品')} <span>→</span></button>
    <div className="cinema-timeline" aria-hidden="true"><i></i></div>
 </dialog></div>,document.body);
}
