import {CheckIcon,ArrowRightIcon} from '@radix-ui/react-icons';
import './stage-journey.css';
export interface JourneySnapshot{cover:null|{id:string;amount:number;commission:number|null;rateBps:number|null;state:'offered'|'purchased'|'completed';code:string|null;artwork:{title:string;cover:string;description:string;episodes:number;language:string;genre:string}};newcomer:{registration:boolean;identity:boolean;experience:boolean;card:boolean;withdrawal:boolean;graduate:boolean;complete:boolean};onboarding:{step:number|null;revealed:boolean};community:{completed:number;revealed:number;answers:Record<string,unknown>;code:string|null}}
const titles=['注册成功','完成实名认证','购买版权封面','绑定提款方式','首次提现到账','新手毕业奖励'];
const copy=['','提交本人身份资料，审核通过即可完成。','购买封面后，复制并提交版权码。','添加本人的提款方式，即可完成。','提交首次提现申请，并查看出款进度。','属于你的第一份成长纪念。'];
export function NewcomerProgress({data,onTake,busy,experienceCommission=0}:{data:JourneySnapshot|null;onTake:()=>void;busy:boolean;experienceCommission?:number}){
 const n=data?.newcomer,step=data?.onboarding.step,revealed=data?.onboarding.revealed,done=n?.complete;
 const states=n?[n.registration,n.identity,n.experience,n.card,n.withdrawal,n.graduate]:[];
 const amounts=[100,100,experienceCommission,0,0,200];
 return <>
 <section className="newcomer-intro"><small>YOUR STORY STARTS HERE</small><h2>{done?'这一章，圆满完成':'每一步，都有新收获'}</h2><p>{done?'新的旅程，已经为你准备好。':'让你的第一份故事，从这里开始。'}</p></section>
 {!data?<p role="status">正在加载你的计划…</p>:!done&&(!revealed||step!==2)&&<section className={'newcomer-mission'+(!revealed?' is-sealed':'')}>
 {!revealed?<><div className="journey-invitation-art"><div className="journey-invitation-orbit"/><img src="/art/task-invitation-v1.png" alt="一份尚未开启的任务邀请"/></div><h2>有一份邀请，等你开启</h2><button className="newcomer-cta" disabled={busy} onClick={onTake}>{busy?'正在开启…':'领取任务'}<ArrowRightIcon/></button></>
 :<><span className="newcomer-current-label">当前任务</span><h2>{titles[step??0]}</h2><p>{copy[step??0]}</p>{step===1&&<div className="newcomer-reward-line"><span>完成奖励</span><b>$1.00</b></div>}<a className="newcomer-cta" href="/?view=app&page=wallet">{step===1?'去完成认证':step===3?'绑定提款方式':step===4?'查看提现进度':'查看奖励'}<ArrowRightIcon/></a></>}
 </section>}
 {done&&<section className="newcomer-completed"><div>✦</div><h2>第一份成就，属于你</h2><a className="newcomer-cta" href="/?view=app&design=advanced">开启下一段旅程<ArrowRightIcon/></a></section>}
 {states.some(Boolean)&&<section className="newcomer-history"><header><h2>已完成</h2><span>{states.filter(Boolean).length} 项</span></header>{states.map((complete,i)=>complete&&<div key={i} className="newcomer-history-row"><span><CheckIcon/></span><div><h3>{i===2&&!data?.cover?'漫剧体验任务':titles[i]}</h3><p>{i===2?(data?.cover?'版权码已核验':'作品已通过审核'):i===4?'首次出款已完成':i===3?'提款方式已添加':'已完成'}</p>{i===2&&data?.cover?.state==='completed'&&<details className="newcomer-code-history"><summary>查看版权码</summary><code>{data.cover.code}</code></details>}</div>{amounts[i]>0&&<b>+ ${(amounts[i]/100).toFixed(2)}</b>}</div>)}</section>}
 </>;
}
