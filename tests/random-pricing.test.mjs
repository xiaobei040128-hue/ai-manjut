import test from 'node:test';import assert from 'node:assert/strict';
import {parseRandomPricing,randomPricedAmount} from '../server/random-pricing.mjs';
import {createStore} from '../server/store.mjs';import {createCreatorAuth} from '../server/creator-auth.mjs';import {createStageEnrollments} from '../server/stage-enrollments.mjs';import {createOperatorScope} from '../server/operators.mjs';import {createPlanDispatch} from '../server/plan-dispatch.mjs';import {createStageDispatch} from '../server/stage-dispatch.mjs';import {createThirdCopyright} from '../server/third-copyright.mjs';
test('custom random ranges validate cents and include both endpoints',()=>{
 for(const value of [{minAmount:'0',maxAmount:100},{minAmount:201,maxAmount:200},{minAmount:'1.001',maxAmount:2},{minAmount:1,maxAmount:1000001},[],{}])assert.throws(()=>parseRandomPricing(value));
 assert.equal(randomPricedAmount(parseRandomPricing({minAmount:'17.33',maxAmount:'17.33'})),1733);
 const p=parseRandomPricing({minAmount:'200.11',maxAmount:'200.12'}),samples=new Set(Array.from({length:100},()=>randomPricedAmount(p)));assert.deepEqual([...samples].sort(),[20011,20012]);
});
test('custom ranges persist per customer/day, apply to ordinary and premium, retain overrides and revealed quotes',async()=>{
 const s=createStore(':memory:');try{
 const auth=createCreatorAuth(s,4997),scope=createOperatorScope(s),op={id:'super',role:'super',username:'random-qa'};createStageEnrollments(s,scope);const config=createPlanDispatch(s,scope),draw=createStageDispatch(s),copyright=createThirdCopyright(s),invite=auth.createInvite('random-qa',{});
 const register=async email=>(await auth.register({headers:{},socket:{remoteAddress:email}},{email,password:'RandomTest2026!',inviteCode:invite.code})).user;
 const u=await register('range@example.invalid'),other=await register('other-range@example.invalid');
 s.db.prepare("INSERT INTO stage_enrollments(id,user_id,status,created_at) VALUES('range-approval',?,'approved',?)").run(u.id,new Date().toISOString());s.setCommissionRate('5');s.createTask({title:'Murder at 30,000 Feet',description:'Range fixture',stage:3,platform:'TikTok',language:'英文',genre:'剧情',deposit:'1',posts:1,episodes:1,slots:100,cover:'/art/hero-v2.webp'});
 s.db.prepare("INSERT INTO ledger(kind,amount,balance_after,note,operation_key,created_at,owner_id) VALUES('deposit',1000000,1000100,'range test','range-funding',?,?)").run(new Date().toISOString(),u.id);
 const slots={2:{premium:true},3:{premium:false,amount:'17.33',rate:'3.25'}};
 config.save(op,u.id,{planDay:1,revision:0,standard:{amount:'999',rate:'3.50'},slots,randomPricing:{minAmount:'210.11',maxAmount:'210.12'}});
 assert.deepEqual(createPlanDispatch(s,scope).list(op,u.id).plans[0].configuration.randomPricing,{minAmount:21011,maxAmount:21012});assert.equal(config.list(op,other.id).plans[0].configuration.randomPricing,undefined);
 assert.throws(()=>config.list({role:'agent',id:'unrelated'},u.id),e=>e.status===403);
 assert.throws(()=>config.save(op,u.id,{planDay:2,revision:0,standard:null,slots:{},randomPricing:{minAmount:10,maxAmount:5}}));
 assert.throws(()=>config.save(op,u.id,{planDay:2,revision:0,standard:null,slots:{},randomPricing:{minAmount:1,maxAmount:2},balancePricing:{minPercent:20,maxPercent:75}}));
 const first=draw.draw(u.id,3);assert.ok([21011,21012].includes(first.task.deposit));assert.equal(first.task.commission_rate_bps,350);
 config.save(op,u.id,{planDay:1,revision:1,standard:null,slots,randomPricing:{minAmount:'312.34',maxAmount:'312.34'}});assert.equal(draw.draw(u.id,3).task.deposit,first.task.deposit);
 const complete=offer=>{const a=draw.accept(u.id,offer.id,{amount:offer.task.deposit,commission:offer.task.commission,rateBps:offer.task.commission_rate_bps});copyright.complete(u.id,{assignmentId:a.id,code:copyright.snapshot(u.id,a.id).code});};complete(first);
 const premium=draw.draw(u.id,3);assert.equal(premium.task.premium,1);assert.equal(premium.task.deposit,31234);complete(premium);
 const override=draw.draw(u.id,3);assert.equal(override.task.deposit,1733);assert.equal(override.task.commission_rate_bps,325);
 config.save(op,u.id,{planDay:2,revision:0,standard:null,slots:{},randomPricing:{minAmount:'9.99',maxAmount:'10.01'}});assert.deepEqual(config.list(op,u.id).plans[1].configuration.randomPricing,{minAmount:999,maxAmount:1001});
 config.save(op,u.id,{planDay:2,revision:1,standard:{amount:'88.88',rate:3},slots:{},randomPricing:null});assert.equal(config.list(op,u.id).plans[1].configuration.randomPricing,undefined);
 }finally{s.close();}
});
