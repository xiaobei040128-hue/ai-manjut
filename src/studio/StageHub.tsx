import {useEffect,useState} from 'react';
import {ArrowRightIcon,ReaderIcon,CheckIcon,LockClosedIcon} from '@radix-ui/react-icons';
import {api,type Bootstrap} from '../api';
import './stage-hub.css';
import {type JourneySnapshot} from './NewcomerProgress';
export default function StageHub({compact=false}:{compact?:boolean}){
 const [journey,setJourney]=useState<JourneySnapshot|null>(null);
 const [data,setData]=useState<(Bootstrap&{stageThreeEligible:boolean;dispatch:{complete:boolean;totalCompleted:number;total:number}})|null>(null),[error,setError]=useState('');
 useEffect(()=>{let alive=true;void api<JourneySnapshot>('/stage-journey').then(v=>{if(alive)setJourney(v);}).catch(()=>{});void api<Bootstrap&{stageThreeEligible:boolean;dispatch:{complete:boolean;totalCompleted:number;total:number}}>('/stage-finance').then(v=>{if(alive)setData(v);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[]);
 const completed=data?.assignments.filter(a=>a.status==='completed')||[],stage=data?.stageThreeEligible||journey?.community.completed===5||completed.some(a=>a.task.stage===2)?3:journey?.newcomer.complete?2:1;
 const names=['新手成长计划','故事探索计划','作品创作计划'];
 const current=data?.assignments.find(a=>a.task.stage===stage&&['active','review','revision'].includes(a.status));
 const href=current?'/?view=app&page=assignment&assignment='+encodeURIComponent(current.id):'/?view=app&design='+['newcomer','advanced','third'][stage-1];
 return <section className={'s-stage-hub hub-redesign'+(compact?' is-compact':'')} aria-label="阶段任务中心">
  <div className="hub-heading"><div><span>YOUR CREATOR JOURNEY</span><h2>{compact?'继续你的创作旅程':'每一步，都有新故事'}</h2></div></div>
  <div className="hub-current-card"><div className="hub-current-top"><span className="hub-task-icon"><ReaderIcon/></span><div><small>当前创作计划</small><h3>{names[stage-1]}</h3></div><img src="/art/task-invitation-v1.png" alt=""/></div><p>{current?(current.status==='review'?'作品已提交审核，你可以查看当前进度。':'你有一份创作正在进行，继续完成作品并提交审核。'):stage===3&&data?.dispatch.complete?'本期全部作品已完成，创作记录已保存。':stage===3&&data?`五天作品计划 · 已完成 ${data.dispatch.totalCompleted} / ${data.dispatch.total} 部作品。`:data?'有一份新的邀请，等你开启。':error||'正在同步你的创作进展…'}</p><a className="s-stage-hub-continue" href={href}>{current?(current.status==='review'?'查看审核进度':'继续当前作品'):stage===3&&data?.dispatch.complete?'查看计划记录':'开启本章'}<ArrowRightIcon/></a></div>
 </section>;
}
