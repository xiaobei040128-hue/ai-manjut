import {AppError} from './store.mjs';
// Every read remains owner-scoped. These indexes contain no new customer data.
export function createTaskHistory(store,serialize){
 const db=store.db;db.exec("CREATE INDEX IF NOT EXISTS assignments_owner_history ON assignments(owner_id,status,COALESCE(reviewed_at,created_at) DESC,id DESC)");
 const total=user=>db.prepare("SELECT COUNT(*) n FROM assignments a JOIN assignment_terms f ON f.assignment_id=a.id WHERE a.owner_id=? AND a.status='completed' AND f.stage=3").get(user).n;
 function scope(user,plan,requested){const ids=db.prepare('SELECT assignment_id id FROM third_plan_items WHERE owner_id=? AND position>=? AND position<? AND assignment_id IS NOT NULL').all(user,(plan.batch-1)*plan.dailyLimit,plan.batch*plan.dailyLimit).map(r=>r.id);ids.push(...db.prepare("SELECT a.id FROM assignments a JOIN assignment_terms f ON f.assignment_id=a.id WHERE a.owner_id=? AND f.stage=3 AND a.status IN ('active','review','revision')").all(user).map(r=>r.id));if(requested){if(typeof requested!=='string'||requested.length>100||!db.prepare('SELECT 1 FROM assignments a JOIN assignment_terms f ON f.assignment_id=a.id WHERE a.id=? AND a.owner_id=? AND f.stage=3').get(requested,user))throw new AppError('版权任务不存在',404);ids.push(requested);}return [...new Set(ids)];}
 function page(user,cursor=''){
  let before=null;if(cursor){try{if(typeof cursor!=='string'||cursor.length>400||!/^[A-Za-z0-9_-]+$/.test(cursor))throw 0;before=JSON.parse(Buffer.from(cursor,'base64url').toString());if(typeof before.id!=='string'||!before.id||before.id.length>100||typeof before.at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(before.at)||!Number.isFinite(Date.parse(before.at)))throw 0;}catch{throw new AppError('记录位置无效，请重新打开收藏册',400);}}
  const key='COALESCE(a.reviewed_at,a.created_at)',rows=db.prepare("SELECT a.id,"+key+" at FROM assignments a JOIN assignment_terms f ON f.assignment_id=a.id WHERE a.owner_id=? AND a.status='completed' AND f.stage=3"+(before?' AND ('+key+'<? OR ('+key+'=? AND a.id<?))':'')+' ORDER BY '+key+' DESC,a.id DESC LIMIT 51').all(user,...(before?[before.at,before.at,before.id]:[])),selected=rows.slice(0,50),last=selected.at(-1);
  const data=store.asUser(user,()=>store.summary({taskView:true,assignmentIds:selected.map(r=>r.id)})),map=new Map(data.assignments.map(a=>[a.id,a]));return {items:selected.map(r=>serialize(map.get(r.id))),nextCursor:rows.length>50?Buffer.from(JSON.stringify(last)).toString('base64url'):null,total:total(user)};
 }
 return {scope,page,total};
}
