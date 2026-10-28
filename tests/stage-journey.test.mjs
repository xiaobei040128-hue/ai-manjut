import {createFundPassword} from '../server/fund-password.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createStore} from '../server/store.mjs';
import {createCreatorAuth} from '../server/creator-auth.mjs';
import {createFinance} from '../server/finance.mjs';
import {createStageJourney} from '../server/stage-journey.mjs';
import {createStageEnrollments} from '../server/stage-enrollments.mjs';
import {createOperatorScope} from '../server/operators.mjs';
test('original onboarding rewards and five explorations persist, validate, isolate and pay only once',async()=>{
 await mkdir(resolve('work'),{recursive:true});const dir=await mkdtemp(resolve('work/journey-test-')),s=createStore(join(dir,'workspace.sqlite'));
 try{
  const auth=createCreatorAuth(s,4990),finance=createFinance(s,dir),journey=createStageJourney(s),enrollment=createStageEnrollments(s,createOperatorScope(s));
  const invitation=auth.createInvite('qa',{},'super'),req={headers:{},socket:{remoteAddress:'qa'}},register=async email=>(await auth.register(req,{email,password:'JourneyTestQA123!',inviteCode:invitation.code})).user;
  const a=await register('journey-a@example.invalid'),b=await register('journey-b@example.invalid'),image=(await readFile('public/art/poster0.png')).toString('base64');
createFundPassword(s).save(a.id,{loginPassword:'JourneyTestQA123!',newPassword:'Funds-Only-QA-2026!',confirmPassword:'Funds-Only-QA-2026!'});
  assert.equal(journey.sync(a.id).newcomer.complete,false);assert.equal(journey.snapshot(a.id).onboarding.step,1);assert.equal(journey.snapshot(a.id).onboarding.revealed,false);assert.equal(journey.take(a.id).onboarding.revealed,true);assert.equal(journey.snapshot(b.id).onboarding.revealed,false);assert.throws(()=>journey.reveal(a.id),e=>e.status===403);
  let identity=finance.identity(a.id,{name:'测试用户',documentType:'驾驶证',number:'TEST-DRIVER-001',frontPhoto:{data:image},backPhoto:{data:image}});assert.equal(journey.snapshot(a.id).identityReview.status,'review');assert.equal(journey.snapshot(a.id).onboarding.step,1);assert.equal(journey.snapshot(b.id).identityReview,null);finance.review('qa','identity',identity.id,{decision:'reject',note:'请重新上传清晰照片'});assert.equal(journey.snapshot(a.id).identityReview.status,'rejected');assert.equal(journey.snapshot(a.id).identityReview.note,'请重新上传清晰照片');identity=finance.identity(a.id,{name:'测试用户',documentType:'驾驶证',number:'TEST-DRIVER-001',frontPhoto:{data:image},backPhoto:{data:image}});assert.equal(journey.snapshot(a.id).identityReview.status,'review');finance.review('qa','identity',identity.id,{decision:'approve'});
  assert.equal(journey.sync(a.id).rewards[0].amount,100);assert.equal(journey.snapshot(a.id).onboarding.step,2);assert.equal(journey.snapshot(a.id).onboarding.revealed,false);assert.equal(journey.sync(a.id).rewards.length,0);
  s.setCommissionRate('5');const task=s.createTask({title:'新手作品任务',description:'发布作品',platform:'TikTok',language:'中文',genre:'剧情',deposit:'1',posts:1,episodes:12,slots:100,cover:'/art/hero-v2.webp',stage:1});
  const as=fn=>s.asUser(a.id,fn),assignment=as(()=>s.claim(task.id,{amount:task.deposit,commission:task.commission,rateBps:task.commission_rate_bps}));
  const upload=as(()=>s.addUpload(assignment.id,{name:'proof.png',mime:'image/png',size:24,path:'/uploads/11111111-1111-1111-1111-111111111111.png'}));as(()=>s.submit(assignment.id,{links:['https://example.invalid/proof'],uploadIds:[upload.id]}));s.review(assignment.id,{decision:'approve'});
  finance.card(a.id,{provider:'okx',number:'12345678'});const card=finance.snapshot(a.id).cards[0];
  const request=finance.apply(a.id,{kind:'withdrawal',fundPassword:'Funds-Only-QA-2026!',amount:'1',cardId:card.id,operationKey:'first-withdrawal-journey-01'});finance.review('qa','fund',request.id,{decision:'approve'});assert.equal(journey.sync(a.id).newcomer.graduate,false);
  finance.review('qa','fund',request.id,{decision:'paid',reference:'QA-PAID-JOURNEY-001'});const graduated=journey.sync(a.id);assert.equal(graduated.newcomer.complete,true);assert.equal(graduated.rewards[0].amount,200);assert.equal(journey.sync(a.id).rewards.length,0);assert.equal(as(()=>s.summary()).wallet.available,305);
  assert.equal(journey.snapshot(b.id).newcomer.complete,false);assert.throws(()=>journey.submit(b.id,{step:0,answer:0}),e=>e.status===403);
  finance.adjust('qa',a.id,{direction:'credit',amount:'100',note:'版权购买测试资金',operationKey:'community-license-funding-01'});
  const inputs=[{answer:0},{review:'我觉得人工智能漫剧的画面与剧情都很吸引人'},{genre:'荒岛求生与末日探险'}];let commissions=0;
  for(let step=0;step<5;step++){
   assert.equal(journey.snapshot(a.id).community.code,null);assert.throws(()=>journey.submit(a.id,{step,...inputs[step]}),e=>e.status===409);
   const revealed=journey.reveal(a.id);assert.equal(revealed.community.revealed,step);assert.equal(journey.reveal(a.id).community.revealed,step);
   if(step===0)assert.throws(()=>journey.submit(a.id,{step,answer:1}));
   let payload=inputs[step];if(step>=3){let q=revealed.community.license;if(step===3){const held=as(()=>s.summary()).wallet.held,available=as(()=>s.summary()).wallet.available;assert.equal(q.reservedAmount,q.amount);journey.cancelLicense(a.id,{step,orderId:q.id});assert.equal(as(()=>s.summary()).wallet.available,available+q.reservedAmount);assert.equal(as(()=>s.summary()).wallet.held,held-q.reservedAmount);journey.cancelLicense(a.id,{step,orderId:q.id});assert.equal(as(()=>s.summary()).wallet.available,available+q.reservedAmount);q=journey.reveal(a.id).community.license;assert.equal(q.reservedAmount,q.amount);}assert.equal(q.amount,step===3?6789:4333);assert.equal(journey.reveal(a.id).community.license.commission,q.commission);const before=as(()=>s.summary()).wallet.available;journey.purchaseLicense(a.id,{step,orderId:q.id,amount:q.amount,commission:q.commission});assert.equal(as(()=>s.summary()).wallet.available,before-(q.amount-(q.reservedAmount||0)));const bought=journey.snapshot(a.id).community.license;assert.ok(bought.code);assert.throws(()=>journey.submit(a.id,{step,code:'wrong'}));commissions+=q.commission;payload={code:bought.code};}
   journey.submit(a.id,{step,...payload});assert.throws(()=>journey.submit(a.id,{step,...payload}),e=>e.status===409);
   assert.equal(journey.snapshot(a.id).community.completed,step+1);
  }
  assert.equal(enrollment.status(a.id).eligible,true);assert.equal(enrollment.status(b.id).eligible,false);
  assert.equal(createStageJourney(s).snapshot(a.id).community.completed,5);assert.equal(journey.snapshot(b.id).community.completed,0);assert.equal(as(()=>s.summary()).wallet.available,10506+commissions);
 }finally{s.close();}
});
