import {saveDispatchDefaults} from '../server/dispatch-defaults.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,mkdirSync} from 'node:fs';import {join,resolve} from 'node:path';
import {createStore} from '../server/store.mjs';import {createCreatorAuth} from '../server/creator-auth.mjs';import {createFinance} from '../server/finance.mjs';import {createStageJourney} from '../server/stage-journey.mjs';import {createStageDispatch} from '../server/stage-dispatch.mjs';import {createThirdCopyright} from '../server/third-copyright.mjs';import {syncStoryTasks} from '../server/sync-story-tasks.mjs';import {createPlanDispatch} from '../server/plan-dispatch.mjs';import {createOperatorScope} from '../server/operators.mjs';
test('new admin work is actually offered with its own metadata and 100 percent reserves the available balance',async()=>{
 mkdirSync(resolve('change'),{recursive:true});const dir=mkdtempSync(resolve('change/integration-')),s=createStore(join(dir,'workspace.sqlite'));
 try{const auth=createCreatorAuth(s,4901),f=createFinance(s,dir),d=createStageDispatch(s);s.setCommissionRate('4');
 const task=s.createTask({title:'New published work',description:'New work description',genre:'原创',cover:'/art/hero-v2.webp',stage:3,platform:'TikTok',language:'中文',deposit:100,commission:20,posts:3,episodes:50});
 s.db.prepare('UPDATE tasks SET active=0 WHERE id!=?').run(task.id);
 const invite=auth.createInvite('qa',{},'super'),reg=await auth.register({headers:{},socket:{remoteAddress:'qa'}},{email:'catalog@example.invalid',password:'TestDaily123!',inviteCode:invite.code}),id=reg.user.id;
 f.adjust('qa',id,{direction:'credit',amount:'100',note:'isolated test credit',operationKey:'new-catalog-credit'});
 saveDispatchDefaults(s,'qa',{revision:0,balancePricing:{minPercent:100,maxPercent:100}});
 const q=d.draw(id,3);assert.equal(q.task.title,task.title);assert.equal(q.task.description,task.description);assert.equal(q.task.id,task.id);assert.equal(q.task.deposit,10000);
 const a=d.accept(id,q.id,{amount:q.task.deposit,commission:q.task.commission,rateBps:q.task.commission_rate_bps});assert.equal(a.task.id,task.id);
 }finally{s.db.close();}
});
test('fresh account directly takes 50 balance-priced tasks; idempotent settlement; customer policy overrides; no old-stage reward',async()=>{mkdirSync(resolve('change'),{recursive:true});const dir=mkdtempSync(resolve('change/integration-')),s=createStore(join(dir,'workspace.sqlite'));try{const auth=createCreatorAuth(s,4901),f=createFinance(s,dir);createStageJourney(s);const d=createStageDispatch(s),copyright=createThirdCopyright(s),scope=createOperatorScope(s),config=createPlanDispatch(s,scope);s.setCommissionRate('4');syncStoryTasks(s);const invite=auth.createInvite('qa',{},'super'),reg=await auth.register({headers:{},socket:{remoteAddress:'qa'}},{email:'daily@example.invalid',password:'TestDaily123!',inviteCode:invite.code}),id=reg.user.id;assert.equal(reg.registrationReward,undefined);const as=fn=>s.asUser(id,fn);assert.equal(as(()=>s.summary()).wallet.available,0);f.adjust('qa',id,{direction:'credit',amount:'100',note:'isolated test credit',operationKey:'daily30-test-credit'});assert.throws(()=>d.draw(id,1),e=>e.status===410);assert.throws(()=>d.draw(id,2),e=>e.status===410);const op={role:'super',username:'qa'},plans=config.list(op,id);assert.equal(plans.plans[0].quota,50);assert.deepEqual(plans.plans[0].configuration.balancePricing,{minPercent:20,maxPercent:75});for(let i=0;i<50;i++){const available=as(()=>s.summary()).wallet.available,q=d.draw(id,3);assert.ok(q.task.deposit>=Math.round(available*.2)&&q.task.deposit<=Math.round(available*.75));assert.equal(d.draw(id,3).id,q.id);if(i===0){saveDispatchDefaults(s,'qa',{revision:0,balancePricing:{minPercent:20,maxPercent:20}});assert.equal(d.draw(id,3).task.deposit,q.task.deposit);saveDispatchDefaults(s,'qa',{revision:1,balancePricing:{minPercent:20,maxPercent:75}});}const a=d.accept(id,q.id,{amount:q.task.deposit,commission:q.task.commission,rateBps:q.task.commission_rate_bps});assert.throws(()=>d.draw(id,3));const state=copyright.snapshot(id,a.id);assert.throws(()=>copyright.complete(id,{assignmentId:a.id,code:'wrong'}));const settled=copyright.complete(id,{assignmentId:a.id,code:state.code});assert.equal(settled.first,true);assert.equal(as(()=>s.summary()).wallet.available,available+q.task.commission);assert.equal(copyright.complete(id,{assignmentId:a.id,code:state.code}).first,false);}assert.equal(as(()=>s.dispatchStatus()).dailyCompleted,50);assert.throws(()=>d.draw(id,3),e=>e.status===409);assert.equal(as(()=>s.summary()).wallet.held,0);const reg2=await auth.register({headers:{},socket:{remoteAddress:'qa2'}},{email:'daily2@example.invalid',password:'TestDaily123!',inviteCode:invite.code}),b=reg2.user.id;f.adjust('qa',b,{direction:'credit',amount:'200',note:'isolated test',operationKey:'daily30-test-credit-2'});const before=config.list(op,b).plans[0];config.save(op,b,{planDay:1,revision:before.revision,balancePricing:{minPercent:40,maxPercent:40},randomPricing:null,standard:null,slots:{}});const quote=d.draw(b,3);assert.equal(quote.task.deposit,8000);assert.equal(as(()=>s.dispatchStatus()).dailyCompleted,50);}finally{s.db.close();}});

test('mixed tiers avoid repeating works even when every planned title is the same',async()=>{
 const dir=mkdtempSync(resolve('change/integration-')),store=createStore(join(dir,'workspace.sqlite'));
 try{
  syncStoryTasks(store);
  const auth=createCreatorAuth(store,4901),finance=createFinance(store,dir);
  const dispatch=createStageDispatch(store),copyright=createThirdCopyright(store);
  const invite=auth.createInvite('qa',{},'super');
  const {user}=await auth.register({headers:{},socket:{remoteAddress:'dedupe-qa'}},{email:'dedupe@example.invalid',password:'TestDaily123!',inviteCode:invite.code});
  finance.adjust('qa',user.id,{direction:'credit',amount:'100',operationKey:'dedupe-test-credit'});
  store.asUser(user.id,()=>store.dispatchStatus());
  const planned=store.db.prepare('SELECT id FROM tasks WHERE stage=3 AND premium=1 LIMIT 1').get();
  store.db.prepare('UPDATE third_plan_items SET story_id=? WHERE owner_id=?').run('task:'+planned.id,user.id);
  const plans=createPlanDispatch(store,createOperatorScope(store));
  const slots=Object.fromEntries(Array.from({length:50},(_,i)=>[i+1,{premium:i%2===1,amount:'10',rate:'1'}]));
  plans.save({role:'super',username:'qa'},user.id,{planDay:1,revision:0,standard:null,slots});
  const seen=new Set();
  for(let i=0;i<50;i++){
   const quote=dispatch.draw(user.id,3);
   assert.equal(!!quote.task.premium,i%2===1);
   assert.ok(!seen.has(quote.task.id),'Repeated work: '+quote.task.title);
   seen.add(quote.task.id);
   assert.equal(dispatch.draw(user.id,3).id,quote.id);
   const assignment=dispatch.accept(user.id,quote.id,{amount:quote.task.deposit,commission:quote.task.commission,rateBps:quote.task.commission_rate_bps});
   const {code}=copyright.snapshot(user.id,assignment.id);
   assert.equal(copyright.complete(user.id,{assignmentId:assignment.id,code}).first,true);
  }
  assert.equal(seen.size,50);
  assert.equal(store.asUser(user.id,()=>store.dispatchStatus()).dailyCompleted,50);
 }finally{store.close();}
});
