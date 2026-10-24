import {useEffect,useState} from 'react';
import {ArrowRightIcon,ReaderIcon} from '@radix-ui/react-icons';
import {api,type Bootstrap} from '../api';
import './stage-hub.css';
export default function StageHub({compact=false}:{compact?:boolean}){
 const [data,setData]=useState<Bootstrap|null>(null),[error,setError]=useState('');
 useEffect(()=>{let alive=true;void api<Bootstrap>('/stage-finance').then(v=>{if(alive)setData(v);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[]);
 const completed=data?.assignments.filter(a=>a.status==='completed')||[],stage=completed.some(a=>a.task.stage===2)?3:completed.some(a=>a.task.stage===1)?2:1;
 return <section className={'s-stage-hub'+(compact?' is-compact':'')} aria-label="阶段任务中心"><div className="s-stage-hub-art"><img src="/art/task-invitation-v1.png" alt="创作任务邀请函"/><span>CREATOR JOURNEY</span><h2>下一段故事，由你开启</h2><p>明确任务要求 · 每一步都有记录</p></div><div className="s-stage-hub-current"><div className="s-stage-hub-label"><ReaderIcon/>当前阶段 <b>0{stage}</b></div><h3>{['新手创作计划','进阶创作计划','高阶创作计划'][stage-1]}</h3><p>{data?'已审核完成 '+completed.length+' 项任务。领取时冻结本金，审核通过后结算佣金。':error||'正在同步阶段任务…'}</p><a className="s-stage-hub-continue" href={'/?view=app&design='+['newcomer','advanced','third'][stage-1]}>进入阶段任务<ArrowRightIcon/></a></div>{!compact&&<div className="s-stage-hub-locked"><ReaderIcon/><div><b>三个阶段，持续创作</b><p>第一阶段审核通过后开放第二阶段，第二阶段完成后申请第三阶段报名。</p></div></div>}</section>;
}
