import {useEffect,useState} from 'react';
import {ArrowRightIcon,ReaderIcon,CheckIcon,LockClosedIcon} from '@radix-ui/react-icons';
import {api,type Bootstrap} from '../api';
import './stage-hub.css';
export default function StageHub({compact=false}:{compact?:boolean}){
 const [data,setData]=useState<Bootstrap|null>(null),[error,setError]=useState('');
 useEffect(()=>{let alive=true;void api<Bootstrap>('/stage-finance').then(v=>{if(alive)setData(v);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[]);
 const completed=data?.assignments.filter(a=>a.status==='completed')||[],stage=completed.some(a=>a.task.stage===2)?3:completed.some(a=>a.task.stage===1)?2:1;
 const names=['新手创作','进阶创作','高阶创作'];
 const current=data?.assignments.find(a=>a.task.stage===stage&&['active','revision'].includes(a.status));
 const href=current?'/?view=app&page=assignment&assignment='+encodeURIComponent(current.id):'/?view=app&design='+['newcomer','advanced','third'][stage-1];
 return <section className={'s-stage-hub hub-redesign'+(compact?' is-compact':'')} aria-label="阶段任务中心">
  <div className="hub-heading"><div><span>YOUR CREATOR JOURNEY</span><h2>{compact?'继续你的创作旅程':'每一步，都有新故事'}</h2></div><span className="hub-chapter">阶段 0{stage}</span></div>
  <ol className="hub-roadmap" aria-label="创作阶段">{names.map((name,index)=><li key={name} className={index+1<stage?'is-done':index+1===stage?'is-current':''} aria-current={index+1===stage?'step':undefined}><span>{index+1<stage?<CheckIcon/>:index+1>stage?<LockClosedIcon/>:'0'+(index+1)}</span><b>{name}</b><small>{index+1<stage?'已完成':index+1===stage?'当前阶段':'待解锁'}</small></li>)}</ol>
  <div className="hub-current-card"><div className="hub-current-top"><span className="hub-task-icon"><ReaderIcon/></span><div><small>当前创作计划</small><h3>{names[stage-1]}计划</h3></div><img src="/art/task-invitation-v1.png" alt=""/></div><p>{current?'你有一份创作正在进行，继续完成作品并提交审核。':data?'已审核完成 '+completed.length+' 项任务，选择下一份作品，继续积累创作。':error||'正在同步你的创作进展…'}</p><a className="s-stage-hub-continue" href={href}>{current?'继续当前作品':'查看阶段任务'}<ArrowRightIcon/></a><div className="hub-finance-note"><LockClosedIcon/>领取冻结本金 · 审核后返还并结算佣金</div></div>
  {!compact&&<div className="hub-next-note"><b>创作、提交、收获回响</b><p>第一阶段审核通过后进入进阶创作；完成第二阶段，即可申请高阶创作资格。</p></div>}
 </section>;
}
