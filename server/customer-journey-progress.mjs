import {peekThirdPlan} from './third-plan.mjs';
import {shanghaiDay} from './time.mjs';
export function customerJourneyProgress(db,id){
 const exists=t=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t);
 const one=(t,sql,...args)=>exists(t)?db.prepare(sql).get(...args):null;
 const completed=Number(one('community_progress','SELECT completed FROM community_progress WHERE owner_id=?',id)?.completed||0);
 const approved=!!one('stage_enrollments',"SELECT 1 FROM stage_enrollments WHERE user_id=? AND status='approved'",id);
 const legacy=!!db.prepare("SELECT 1 FROM assignments a JOIN assignment_terms f ON f.assignment_id=a.id WHERE a.owner_id=? AND f.stage=2 AND a.status='completed'").get(id);
 const identity=!!one('identities',"SELECT 1 FROM identities WHERE user_id=? AND status='approved'",id);
 const cover=!!one('newcomer_cover_orders',"SELECT 1 FROM newcomer_cover_orders WHERE owner_id=? AND state='completed'",id)||!!db.prepare("SELECT 1 FROM assignments a JOIN assignment_terms f ON f.assignment_id=a.id WHERE a.owner_id=? AND f.stage=1 AND a.status='completed'").get(id);
 const card=!!one('bank_cards',"SELECT 1 FROM bank_cards WHERE user_id=? AND status='approved'",id);
 const withdrawn=!!one('fund_requests',"SELECT 1 FROM fund_requests WHERE user_id=? AND kind='withdrawal' AND (status='paid' OR newcomer_task=1)",id);
 const graduate=!!db.prepare("SELECT 1 FROM ledger WHERE owner_id=? AND operation_key=?").get(id,'newcomer-graduate:'+id);
 const stage=approved||completed===5||legacy?3:identity&&cover&&card&&withdrawn&&graduate?2:1;
 const planState=peekThirdPlan(db,id);const daily={claimed:planState?.dailyClaimed||0,completed:planState?.dailyCompleted||0};
 const current=db.prepare("SELECT t.title FROM assignments a JOIN assignment_terms f ON f.assignment_id=a.id JOIN tasks t ON t.id=a.task_id WHERE a.owner_id=? AND f.stage=? AND a.status IN ('active','review','revision') ORDER BY a.created_at LIMIT 1").get(id,stage);
 const pending=one('stage_task_offers',"SELECT o.story,t.title FROM stage_task_offers o JOIN tasks t ON t.id=o.task_id WHERE o.owner_id=? AND o.stage=3 AND o.assignment_id IS NULL AND o.retired=0",id);
 const revealedTitle=pending?(pending.story?JSON.parse(pending.story).title:pending.title):null;
 const total=planState?.totalCompleted||0,planDay=planState?.batch||1;
 const steps=['注册成功','实名认证','购买版权封面','绑定提款方式','首次提款申请','毕业奖励'];const flags=[true,identity,cover,card,withdrawn,graduate];const step=flags.findIndex(v=>!v);
 return {stage,timeZone:planState?.timeZone||null,nextUnlockAt:planState?.nextUnlockAt||null,currentOrdinal:stage===3?Math.min(planState?.dailyLimit||10,daily.claimed+(current?0:1)):stage===2?Math.min(5,completed+1):step<0?6:step+1,planDay:stage===3?planDay:null,completed:stage===3?total:stage===2?completed:flags.filter(Boolean).length,total:stage===3?48:stage===2?5:6,dailyLimit:planState?.dailyLimit||(planDay===5?8:10),dailyClaimed:daily.claimed,dailyCompleted:daily.completed,currentTask:current?.title||revealedTitle||(stage===1?(steps[step]||'创作启航已完成'):stage===2?(['认识 AI 漫剧','写下你的感受','填写喜欢的题材','购买单集版权','购买单集版权'][completed]||'等待报名审核'):approved?'等待领取下一项':'等待创作新境报名审核')};
}
