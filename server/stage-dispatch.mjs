import {recordTaskActivity} from './reputation.mjs';
import {dispatchDefaults} from './dispatch-defaults.mjs';
import {samplePercentAmount,sampleCommissionRate} from './decimal-dispatch-pricing.mjs';
import {randomPricedAmount} from './random-pricing.mjs';
import {balancePricedAmount} from './balance-pricing.mjs';
import {planConfiguration} from './plan-dispatch.mjs';
import {createThirdCopyright} from './third-copyright.mjs';
import {readFileSync} from 'node:fs';
import {createTaskBalance} from './task-balance.mjs';
import {shanghaiDay} from './time.mjs';
import {DAILY_TASK_LIMIT} from './third-plan.mjs';
const stories=JSON.parse(readFileSync(new URL('../src/studio/storyCatalog.json',import.meta.url),'utf8'));
import {randomInt,randomUUID} from 'node:crypto';
import {AppError} from './store.mjs';

// Third-stage draws persist both the personal reveal and its balance reservation.
export function createStageDispatch(store){
 const db=store.db,balance=createTaskBalance(store),copyright=createThirdCopyright(store);
 db.exec(`CREATE TABLE IF NOT EXISTS stage_task_offers(
  id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,stage INTEGER NOT NULL,task_id TEXT NOT NULL,
  assignment_id TEXT,created_at TEXT NOT NULL);`);
 if(!db.prepare('PRAGMA table_info(stage_task_offers)').all().some(c=>c.name==='retired')){db.exec('ALTER TABLE stage_task_offers ADD COLUMN retired INTEGER NOT NULL DEFAULT 0; DROP INDEX IF EXISTS stage_offer_pending;');}
 if(!db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND name='stage_offer_pending'").get()?.sql.includes('retired'))db.exec('DROP INDEX IF EXISTS stage_offer_pending');
 db.exec('CREATE UNIQUE INDEX IF NOT EXISTS stage_offer_pending ON stage_task_offers(owner_id) WHERE assignment_id IS NULL AND retired=0');
 if(!db.prepare('PRAGMA table_info(stage_task_offers)').all().some(c=>c.name==='story'))db.exec('ALTER TABLE stage_task_offers ADD COLUMN story TEXT');
 db.exec('CREATE TABLE IF NOT EXISTS third_story_queues(owner_id TEXT NOT NULL,day TEXT NOT NULL,story_order TEXT NOT NULL,PRIMARY KEY(owner_id,day))');
 function storyFor(user,plan){const id=(plan||store.asUser(user,()=>store.dispatchStatus())).nextStoryId;if(id?.startsWith('task:')){const task=db.prepare('SELECT id,title,genre,description,cover FROM tasks WHERE id=?').get(id.slice(5));return task?{id:task.id,title:task.title,genre:task.genre,description:task.description,cover:task.cover}:null;}return stories.find(s=>s.id===id);}
 if(!db.prepare('PRAGMA table_info(stage_task_offers)').all().some(c=>c.name==='pricing'))db.exec('ALTER TABLE stage_task_offers ADD COLUMN pricing TEXT');
 const pending=user=>db.prepare('SELECT * FROM stage_task_offers WHERE owner_id=? AND assignment_id IS NULL AND retired=0').get(user);
 const allowed=(user,id)=>!!db.prepare('SELECT 1 FROM assignments WHERE owner_id=? AND task_id=? UNION ALL SELECT 1 FROM stage_task_offers WHERE owner_id=? AND task_id=? LIMIT 1').get(user,id,user,id);
 const unread=user=>db.prepare('SELECT COUNT(*) n FROM notifications WHERE owner_id=? AND is_read=0 AND (task_id IS NULL OR task_id IN(SELECT task_id FROM assignments WHERE owner_id=? UNION SELECT task_id FROM stage_task_offers WHERE owner_id=? AND assignment_id IS NULL AND retired=0))').get(user,user,user).n;
 const active=user=>db.prepare("SELECT id FROM assignments WHERE owner_id=? AND status IN ('active','review','revision') LIMIT 1").get(user);
 function eligible(user,stage){
  if(stage!==3)throw new AppError('旧阶段已停用，请进入当前任务',410);
  if(stage===1&&db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='newcomer_cover_orders'").get()&&db.prepare('SELECT 1 FROM newcomer_cover_orders WHERE owner_id=?').get(user))throw new AppError('请继续当前版权封面任务',409);
  if(stage===1&&db.prepare("SELECT 1 FROM assignments a JOIN assignment_terms f ON f.assignment_id=a.id WHERE a.owner_id=? AND a.status='completed' AND f.stage=1").get(user))throw new AppError('新手体验任务已完成',409);
  if(stage===2&&!db.prepare("SELECT 1 FROM assignments a JOIN assignment_terms f ON f.assignment_id=a.id WHERE a.owner_id=? AND a.status='completed' AND f.stage=1").get(user))throw new AppError('请先完成第一阶段任务并通过审核',403);
  if(stage===3){const plan=store.dispatchStatus();if(plan.waiting||plan.dailyCompleted>=plan.dailyLimit)throw new AppError(plan.complete?'本期任务已全部完成':'今日任务已领取，请完成后于下一天开启新任务',409);return plan;}
 }
 function offer(row){if(!row)return null;const task=store.getTask(row.task_id);if(row.stage===3){let story=row.story?JSON.parse(row.story):storyFor(row.owner_id);if(story&&!row.story)db.prepare('UPDATE stage_task_offers SET story=? WHERE id=?').run(JSON.stringify(story),row.id);return {id:row.id,stage:3,reservedAmount:balance.amount(row.owner_id,'stage',row.id),task:{...task,...story,...(row.pricing?JSON.parse(row.pricing):{}), id:task.id,episodes:null,platform:'',language:'',catalogStoryId:story?.id}};}return {id:row.id,stage:row.stage,task};}
 function visible(user,summary){
  const ids=new Set(db.prepare('SELECT task_id FROM assignments WHERE owner_id=? UNION SELECT task_id FROM stage_task_offers WHERE owner_id=? AND assignment_id IS NULL AND retired=0').all(user,user).map(r=>r.task_id));
  const notices=summary.notifications.filter(n=>!n.task_id||ids.has(n.task_id));
  return {...summary,tasks:summary.tasks.filter(t=>ids.has(t.id)),savedTasks:summary.savedTasks?.filter(t=>ids.has(t.id)),bookmarks:summary.bookmarks.filter(id=>ids.has(id)),notifications:notices,notificationsUnread:unread(user)};
 }
 return {
  allowed,visible,unread,
  discard(user,id,{administrative=false}={}){if(typeof id!=='string'||!id||id.length>80)throw new AppError('无效的任务标识');return store.asUser(user,()=>store.audited(user,'stage.discard',String(id),()=>{
   const r=db.prepare('SELECT * FROM stage_task_offers WHERE id=? AND owner_id=? AND stage=3').get(id,user);
   if(!r||r.assignment_id)throw new AppError('当前任务无法取消领取',409);
   if(!r.retired){balance.release(user,'stage',r.id);db.prepare('UPDATE stage_task_offers SET retired=1 WHERE id=? AND owner_id=?').run(id,user);}
   return {ok:true};
  },{},{administrative}));},
  reserve(user,id){if(id!==undefined&&(typeof id!=='string'||!id||id.length>80))throw new AppError('无效的任务标识');return store.asUser(user,()=>store.audited(user,'stage.reserve',String(id),()=>{
   const r=pending(user);if(!r&&!id)return null;if(!r||(id&&r.id!==id)||r.stage!==3)throw new AppError('请先领取当前作品',409);eligible(user,3);
   const task=store.getTask(r.task_id);if(!task.active)throw new AppError('作品已暂停，请联系平台处理已领取任务',409);
   balance.reserve(user,'stage',r.id,offer(r).task.deposit,task.title);return offer(r);
  }));},
  pending(user){return store.asUser(user,()=>offer(pending(user)));},
  draw(user,stage){return store.asUser(user,()=>store.audited(user,'stage.draw',String(stage),()=>{
   const planState=eligible(user,stage);
   if(active(user))throw new AppError('请先完成并通过审核当前任务，再领取下一项',409);
   const old=pending(user);if(old){if(old.stage!==stage)throw new AppError('请先接受已领取的任务',409);if(stage===3)balance.reserve(user,'stage',old.id,offer(old).task.deposit,store.getTask(old.task_id).title);if(stage===3)recordTaskActivity(store,user);return offer(old);}
   const configuration=planConfiguration(db,user,planState.batch).configuration,slotConfig=configuration.slots[planState.planSequence];
   const wantPremium=!!slotConfig?.premium;
   const summary=store.drawContext(),tasks=summary.tasks.filter(t=>t.stage===stage&&t.active&&(stories.find(s=>s.title===t.title)?.orderType==='premium')===wantPremium);
   if(!tasks.length)throw new AppError('本阶段暂无可派发任务，请稍后再来',409);
   const roundStart=(planState.batch-1)*DAILY_TASK_LIMIT;
   const used=db.prepare(`
    SELECT a.task_id, COUNT(*) AS times
    FROM third_plan_items i JOIN assignments a ON a.id=i.assignment_id
    WHERE i.owner_id=? AND i.position>=? AND i.position<? AND a.status!='cancelled'
    GROUP BY a.task_id
   `).all(user,roundStart,roundStart+DAILY_TASK_LIMIT);
   const timesByTask=new Map(used.map(row=>[row.task_id,row.times]));
   const fewest=Math.min(...tasks.map(task=>timesByTask.get(task.id)??0));
   // If a tier runs out of unused titles, reuse its least-assigned works.
   const pool=tasks.filter(task=>(timesByTask.get(task.id)??0)===fewest);
   const nextStory=storyFor(user,planState);
   const planned=nextStory&&(pool.find(t=>t.id===nextStory.id)||pool.find(t=>t.title===nextStory.title));
   const selected=planned||pool[randomInt(pool.length)],id=randomUUID();
   db.prepare('INSERT INTO stage_task_offers(id,owner_id,stage,task_id,created_at) VALUES(?,?,?,?,?)').run(id,user,stage,selected.id,new Date().toISOString());
   if(stage===3)db.prepare('UPDATE stage_task_offers SET story=? WHERE id=?').run(JSON.stringify({id:selected.id,title:selected.title,genre:selected.genre,description:selected.description,cover:selected.cover}),id);
   if(stage===3){
    const plan=planState,sequence=plan.planSequence,config=configuration,slot=config.slots[sequence]||{premium:false},premium=slot.premium?1:0,defaults=dispatchDefaults(db),terms=slot.amount!==undefined?slot:!premium?config.standard:null;
    const amountAdd=slot.amountAdd??(premium&&slot.amount===undefined&&slot.amountPercent===undefined?defaults.premium.amountAdd:undefined);
    const balancePolicy=slot.amountPercent!==undefined?{minPercent:slot.amountPercent,maxPercent:slot.amountPercent}:premium?defaults.premium:config.balancePricing;
    const available=slot.amount===undefined&&(amountAdd!==undefined||balancePolicy)?summary.wallet.available:null;
    const sampled=amountAdd!==undefined||available===null?null:samplePercentAmount(available,balancePolicy);
    const deposit=amountAdd!==undefined?available+amountAdd:slot.amount??sampled?.amount??(config.randomPricing?randomPricedAmount(config.randomPricing):terms?.amount??randomPricedAmount(null));
    if(!Number.isSafeInteger(deposit)||deposit<1||deposit>100000000)throw new AppError('订单金额超出支持范围',409);
    const explicitMultiplier=premium?(slot.commissionMultiplier??(slot.rateBps===undefined?defaults.premium.commissionMultiplier:undefined)):undefined;
    const sampledRate=sampleCommissionRate(explicitMultiplier===undefined&&slot.rateBps===undefined&&terms?.rateBps===undefined&&!!premium,defaults.premium,defaults.ordinaryCommission),ordinaryRateBps=config.standard?.rateBps??sampledRate.ordinaryRateBps;
    const rate=explicitMultiplier!==undefined?Math.round(ordinaryRateBps*explicitMultiplier):slot.rateBps??terms?.rateBps??(!premium?ordinaryRateBps:sampledRate.rateBps);
    if(!Number.isSafeInteger(rate)||rate<0||rate>10000)throw new AppError('高阶佣金率超出支持范围，请调整佣金倍数',409);
    db.prepare('UPDATE stage_task_offers SET pricing=? WHERE id=?').run(JSON.stringify({deposit,...(sampled?{balance_pricing:{minPercent:balancePolicy.minPercent,maxPercent:balancePolicy.maxPercent,availableCents:available,sampledPercent:sampled.percent}}:{}),...(amountAdd!==undefined?{balance_addition:{availableCents:available,addedCents:amountAdd}}:{}),...(explicitMultiplier!==undefined?{ordinary_rate_bps:ordinaryRateBps,commission_multiplier:explicitMultiplier}:slot.rateBps===undefined&&terms?.rateBps===undefined?{ordinary_rate_bps:sampledRate.ordinaryRateBps,commission_multiplier:sampledRate.multiplier}:{}),commission_rate_bps:rate,commission:Math.round(deposit*rate/10000),premium,dispatch_sequence:sequence,dispatch_day:plan.today,plan_day:plan.batch,plan_sequence:sequence}),id);
    balance.reserve(user,'stage',id,deposit,selected.title);
   }
   if(stage===3)recordTaskActivity(store,user);
   return offer(pending(user));
  }));},
  accept(user,id,expected){return store.asUser(user,()=>store.audited(user,'stage.accept',String(id),()=>{
   const row=db.prepare('SELECT * FROM stage_task_offers WHERE id=? AND owner_id=?').get(id,user);
   if(!row)throw new AppError('请先领取随机任务',404);
   if(row.retired)throw new AppError('此任务已更新，请返回当前成长计划',409);
   if(row.assignment_id)return store.assignment(row.assignment_id);
   eligible(user,row.stage);
   if(active(user))throw new AppError('请先完成并通过审核当前任务',409);
   if(row.stage===3)balance.convert(user,'stage',row.id);
   const assignment=store.claim(row.task_id,expected);
   db.prepare('UPDATE stage_task_offers SET assignment_id=? WHERE id=? AND owner_id=?').run(assignment.id,id,user);
   if(row.stage===3)copyright.snapshot(user,assignment.id);
   if(row.stage===3)recordTaskActivity(store,user);
   return assignment;
  }));},
  acceptTask(user,taskId,expected){
   if(typeof taskId!=="string"||!taskId||taskId.length>80)throw new AppError("无效的任务标识");
   const old=db.prepare("SELECT id FROM assignments WHERE owner_id=? AND task_id=? AND status IN ('active','review','revision')").get(user,taskId);
   if(old)return store.asUser(user,()=>store.assignment(old.id));
   const row=pending(user);if(!row||row.task_id!==taskId)throw new AppError('请先领取系统随机派发的任务',409);
   return this.accept(user,row.id,expected);
  }
 };
}
