import {createCommunityLicenses} from './community-licenses.mjs';
import {createNewcomerCovers} from './newcomer-covers.mjs';
import {randomBytes} from 'node:crypto';
import {AppError} from './store.mjs';
export function createStageJourney(store){
 const db=store.db,covers=createNewcomerCovers(store),licenses=createCommunityLicenses(store);
 db.exec(`CREATE TABLE IF NOT EXISTS community_progress(owner_id TEXT PRIMARY KEY,completed INTEGER NOT NULL DEFAULT 0,revealed INTEGER NOT NULL DEFAULT -1,answers TEXT NOT NULL DEFAULT '{}',code TEXT NOT NULL,updated_at TEXT NOT NULL);`);
 db.exec('CREATE TABLE IF NOT EXISTS onboarding_reveals(owner_id TEXT NOT NULL,step INTEGER NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(owner_id,step))');
 const has=(sql,id)=>!!db.prepare(sql).get(id);
 function newcomer(id){
  const registration=has("SELECT 1 FROM ledger WHERE owner_id=? AND kind='registration_reward'",id);
  const identity=has("SELECT 1 FROM identities WHERE user_id=? AND status='approved'",id);
  const experience=has("SELECT 1 FROM assignments a JOIN assignment_terms f ON f.assignment_id=a.id WHERE a.owner_id=? AND f.stage=1 AND a.status='completed'",id)||has("SELECT 1 FROM newcomer_cover_orders WHERE owner_id=? AND state='completed'",id);
  const card=has("SELECT 1 FROM bank_cards WHERE user_id=? AND status='approved'",id);
  const withdrawal=has("SELECT 1 FROM fund_requests WHERE user_id=? AND kind='withdrawal' AND (status='paid' OR newcomer_task=1)",id);
  const graduate=has("SELECT 1 FROM ledger WHERE owner_id=? AND operation_key='newcomer-graduate:'||owner_id",id);
  return {registration,identity,experience,card,withdrawal,graduate,complete:identity&&experience&&card&&withdrawal&&graduate};
 }
 function grant(id,amount,key,note){
  if(db.prepare('SELECT 1 FROM ledger WHERE operation_key=?').get(key))return false;
  const balance=db.prepare('SELECT COALESCE(SUM(amount),0) n FROM ledger WHERE owner_id=?').get(id).n;
  db.prepare("INSERT INTO ledger(kind,amount,balance_after,note,operation_key,created_at,owner_id) VALUES('onboarding_reward',?,?,?,?,?,?)").run(amount,balance+amount,note,key,new Date().toISOString(),id);
  store.notifyUser(id,'成长奖励已到账',note+'，已计入可用余额。','finance',key);return true;
 }
 function progress(id){const row=db.prepare('SELECT * FROM community_progress WHERE owner_id=?').get(id);return row?{license:row.revealed===row.completed?licenses.snapshot(id,row.completed):null,completed:row.completed,revealed:row.revealed,answers:JSON.parse(row.answers),code:row.revealed===4||row.completed===5?row.code:null}:{completed:0,revealed:-1,answers:{},code:null};}
 function snapshot(id){
  const n=newcomer(id),states=[true,n.identity,n.experience,n.card,n.withdrawal,n.graduate];
  const running=db.prepare("SELECT 1 FROM assignments a JOIN assignment_terms f ON f.assignment_id=a.id WHERE a.owner_id=? AND f.stage=1 AND a.status IN ('active','review','revision')").get(id);
  const found=running?2:states.findIndex(done=>!done),step=found<0?null:found;
  const pendingWithdrawal=db.prepare("SELECT id,status,amount,created_at FROM fund_requests WHERE user_id=? AND kind='withdrawal' AND status IN ('review','paying') ORDER BY created_at DESC LIMIT 1").get(id)||null;
  return {pendingWithdrawal,newcomer:n,withdrawalInProgress:!!pendingWithdrawal,cover:covers.snapshot(id),onboarding:{step,revealed:step!==null&&(step===4&&!!pendingWithdrawal||!!running||!!db.prepare('SELECT 1 FROM onboarding_reveals WHERE owner_id=? AND step=?').get(id,step))},community:progress(id)};
 }
 return {
  snapshot,
  purchaseLicense(id,input){licenses.purchase(id,input);return snapshot(id);},
  bindingCompletion(id){return store.asUser(id,()=>store.audited(id,'newcomer.binding.notice',id,()=>{const event=db.prepare('SELECT shown FROM newcomer_binding_events WHERE user_id=?').get(id);if(!event||event.shown)return {show:false};db.prepare('UPDATE newcomer_binding_events SET shown=1 WHERE user_id=?').run(id);return {show:true};}));},
  take(id){return store.asUser(id,()=>store.audited(id,'newcomer.take',id,()=>{
   const state=snapshot(id),step=state.onboarding.step;if(step===null)throw new AppError('当前计划已完成',409);
   db.prepare('INSERT OR IGNORE INTO onboarding_reveals(owner_id,step,created_at) VALUES(?,?,?)').run(id,step,new Date().toISOString());
   if(step===2&&!db.prepare("SELECT 1 FROM assignments a JOIN assignment_terms f ON f.assignment_id=a.id WHERE a.owner_id=? AND f.stage=1 AND a.status IN ('active','review','revision')").get(id))covers.reveal(id);
   return snapshot(id);
  }));},
  purchaseCover(id,input){covers.purchase(id,input);return snapshot(id);},
  submitCover(id,input){const settled=covers.submit(id,input);return {...snapshot(id),settlement:{first:settled.first,commission:settled.cover.commission}};},
  sync(id){return store.asUser(id,()=>store.audited(id,'journey.sync',id,()=>{
   const n=newcomer(id),rewards=[];
   if(n.identity&&grant(id,100,'newcomer-identity:'+id,'实名认证奖励 · 1.00 USD'))rewards.push({id:'newcomer-identity:'+id,amount:100});
   if(n.identity&&n.experience&&n.card&&n.withdrawal&&grant(id,200,'newcomer-graduate:'+id,'新手计划完成 · 毕业奖励 2.00 USD'))rewards.push({id:'newcomer-graduate:'+id,amount:200});
   const current=snapshot(id);if(current.onboarding.step===2&&current.onboarding.revealed&&!current.cover&&!db.prepare("SELECT 1 FROM assignments a JOIN assignment_terms f ON f.assignment_id=a.id WHERE a.owner_id=? AND f.stage=1 AND a.status IN ('active','review','revision')").get(id))covers.reveal(id);
   return {...snapshot(id),rewards};
  }));},
  reveal(id){return store.asUser(id,()=>store.audited(id,'community.reveal',id,()=>{
   if(!newcomer(id).complete)throw new AppError('请先完成新手成长计划',403);
   let row=db.prepare('SELECT * FROM community_progress WHERE owner_id=?').get(id);
   if(!row){db.prepare('INSERT INTO community_progress(owner_id,code,updated_at) VALUES(?,?,?)').run(id,randomBytes(4).toString('hex').toUpperCase(),new Date().toISOString());row=db.prepare('SELECT * FROM community_progress WHERE owner_id=?').get(id);}
   if(row.completed<5)db.prepare('UPDATE community_progress SET revealed=completed,updated_at=? WHERE owner_id=?').run(new Date().toISOString(),id);
   if(row.completed>=3&&row.completed<5)licenses.reveal(id,row.completed);
   return snapshot(id);
  }));},
  submit(id,input){return store.asUser(id,()=>store.audited(id,'community.submit',id,()=>{
   if(!newcomer(id).complete)throw new AppError('请先完成新手成长计划',403);
   const row=db.prepare('SELECT * FROM community_progress WHERE owner_id=?').get(id);
   if(!row||row.completed!==input.step||row.revealed!==row.completed||row.completed>=5)throw new AppError('请刷新当前探索记录后提交',409);
   const answers=JSON.parse(row.answers),step=row.completed;
   if(step===0){if(input.answer!==0)throw new AppError('AI 生成不等于自动获得全部权利，请确认素材授权');answers.knowledge=true;}
   if(step===1){if(typeof input.review!=='string'||Array.from(input.review.trim()).length<10||input.review.length>1000)throw new AppError('请填写至少 10 个字的感受');answers.review=input.review.trim();}
   if(step===2){if(typeof input.genre!=='string'||input.genre.trim().length<2||input.genre.length>100)throw new AppError('请填写喜欢的漫剧题材');answers.genre=input.genre.trim();}
   const reward=step<3?[58,66,77][step]:licenses.complete(id,step,input.code);
   if(step<3)grant(id,reward,'community-task:'+id+':'+step,'探索任务奖励');
   db.prepare('UPDATE community_progress SET completed=completed+1,revealed=-1,answers=?,updated_at=? WHERE owner_id=?').run(JSON.stringify(answers),new Date().toISOString(),id);
   return {...snapshot(id),taskReward:reward};
  }));}
 };
}
