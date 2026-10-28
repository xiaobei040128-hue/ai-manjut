import {useCallback,useEffect,useRef,useState} from 'react';
import {api,money} from '../api';
import JourneyEffects,{type JourneyEvent} from './JourneyEffects';
export default function IdentityReward({onReward}:{onReward?:()=>void}){
 const [event,setEvent]=useState<JourneyEvent|null>(null);const shown=useRef(false),callback=useRef(onReward);callback.current=onReward;
 useEffect(()=>{let alive=true;const check=async()=>{if(shown.current||document.visibilityState!=='visible')return;try{const result=await api<{show:boolean;amount:number}>('/stage-journey/identity-reward','POST',{});if(alive&&result.show&&!shown.current){shown.current=true;setEvent({kind:'reward',nonce:Date.now(),amount:money(result.amount),title:'实名认证已通过',subtitle:'实名认证奖励已到账。'});callback.current?.();}}catch{}};void check();const timer=setInterval(()=>void check(),5000);const focus=()=>void check();window.addEventListener('focus',focus);return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',focus);};},[]);
 const close=useCallback(()=>{void api('/stage-journey/identity-reward','POST',{ack:true}).then(()=>setEvent(null)).catch(()=>{});},[]);
 return <JourneyEffects autoClose={false} event={event} onClose={close}/>;
}
