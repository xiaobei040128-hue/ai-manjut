import {peekThirdPlan,DAILY_TASK_LIMIT} from './third-plan.mjs';
export function customerJourneyProgress(db,id){
 const plan=peekThirdPlan(db,id),current=db.prepare("SELECT t.title FROM assignments a JOIN assignment_terms f ON f.assignment_id=a.id JOIN tasks t ON t.id=a.task_id WHERE a.owner_id=? AND f.stage=3 AND a.status IN ('active','review','revision') ORDER BY a.created_at LIMIT 1").get(id);
 const pending=db.prepare("SELECT o.story,t.title FROM stage_task_offers o JOIN tasks t ON t.id=o.task_id WHERE o.owner_id=? AND o.stage=3 AND o.assignment_id IS NULL AND o.retired=0").get(id);
 return {stage:3,timeZone:plan?.timeZone||null,nextUnlockAt:plan?.nextUnlockAt||null,currentOrdinal:Math.min(DAILY_TASK_LIMIT,(plan?.dailyCompleted||0)+1),planDay:plan?.batch||1,completed:plan?.dailyCompleted||0,total:DAILY_TASK_LIMIT,dailyLimit:DAILY_TASK_LIMIT,dailyClaimed:plan?.dailyClaimed||0,dailyCompleted:plan?.dailyCompleted||0,currentTask:current?.title||(pending?(pending.story?JSON.parse(pending.story).title:pending.title):plan?.waiting?'等待次日05:00刷新':'等待领取下一项')};
}
