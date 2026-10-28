import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MobileRuntime} from '../src/mobile';
import LanguageSelector from '../src/i18n/LanguageSelector';
import {useLanguage} from '../src/i18n/language';
import RegistrationReward from '../src/studio/RegistrationReward';
import JourneyEffects,{type JourneyEvent} from '../src/studio/JourneyEffects';
import TaskCelebration from '../src/studio/TaskCelebration';
import {money} from '../src/api';
import '../src/styles.css';
import '../src/prototype.css';
const scenes=[
 ['new-task','task','新的任务已开启','属于你的下一步，从这里开始。'],
 ['cover-task','task','你的版权封面已揭晓','The Lawyer Who Never Lost'],
 ['identity','reward','实名认证已通过','实名认证奖励已到账。'],
 ['graduate','reward','成长奖励已到账','恭喜，离你的下一章更近了一步。'],
 ['binding','complete','绑定任务已完成','提款方式已保存。准备好后，领取下一份任务。'],
 ['community-reveal','task','认识 AI 漫剧','开启属于你的这一次探索。'],
 ['community-reward','reward','探索进度已更新','已保存至你的账号。'],
 ['community-complete','complete','本章探索完成','已保存至你的账号。'],
 ['ordinary-reveal','task','这一单，正式揭晓','QA Story'],
 ['ordinary-complete','reward','佣金已结算','奖励已计入本章记录。'],
] as const;
function AuditAnimations(){useLanguage();const [scene,setScene]=useState(''),[nonce,setNonce]=useState(0),[closed,setClosed]=useState(0);const data=scenes.find(s=>s[0]===scene);const close=()=>{setScene('');setClosed(n=>n+1);};const event:JourneyEvent|null=data?{kind:data[1],title:data[2],subtitle:data[3],nonce,amount:data[1]==='task'?undefined:money(scene==='graduate'?200:100)}:null;
 return <><div className="qa-toolbar" style={{position:'fixed',top:0,left:0,right:0,zIndex:1,background:'white',padding:8,fontSize:12}}><b>QA animation component preview · no rewards issued</b><LanguageSelector/><span data-testid="closed-count">Closed: {closed}</span></div><div style={{padding:'180px 16px 16px',display:'grid',gap:10}}>{['registration',...scenes.map(s=>s[0]),'premium-reveal','premium-settled'].map(s=><button key={s} data-scene={s} onClick={()=>{setScene(s);setNonce(n=>n+1);}}>{s}</button>)}</div>{scene==='registration'?<RegistrationReward amount={100} onClose={close} onStart={close}/>:null}<JourneyEffects autoClose={false} event={event} onClose={close}/><TaskCelebration copyright award={scene.startsWith('premium-')?{id:'qa-'+nonce,title:'QA Story',amount:3000,commission:120,kind:scene==='premium-reveal'?'reveal':'settled',cover:'/stories/beggar-queen.webp'}:null} onClose={close}/></>;
}
createRoot(document.getElementById('root')!).render(<MobileRuntime><div className="studio native-mode"><AuditAnimations/></div></MobileRuntime>);
