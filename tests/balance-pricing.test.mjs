import test from 'node:test';import assert from 'node:assert/strict';
import {balancePricedAmount,parseBalancePricing} from '../server/balance-pricing.mjs';
import {createStore} from '../server/store.mjs';import {createCreatorAuth} from '../server/creator-auth.mjs';import {createStageEnrollments} from '../server/stage-enrollments.mjs';import {createOperatorScope} from '../server/operators.mjs';import {createPlanDispatch} from '../server/plan-dispatch.mjs';import {createStageDispatch} from '../server/stage-dispatch.mjs';import {createThirdCopyright} from '../server/third-copyright.mjs';
test('balance percentages validate bounds and produce cent-level prices inside exact limits',()=>{
 for(const value of [{minPercent:19.99,maxPercent:75},{minPercent:20,maxPercent:75.01},{minPercent:60,maxPercent:30},{minPercent:'20.001',maxPercent:75},[],{}])assert.throws(()=>parseBalancePricing(value));
 assert.deepEqual(parseBalancePricing({minPercent:'20.25',maxPercent:'74.99'}),{minPercent:20.25,maxPercent:74.99});
 const amounts=Array.from({length:50},()=>balancePricedAmount(100000,{minPercent:20,maxPercent:75}));assert.ok(amounts.every(n=>Number.isInteger(n)&&n>=20000&&n<=75000));assert.ok(amounts.some(n=>n%100!==0));assert.ok(new Set(amounts).size>1);
 assert.equal(balancePricedAmount(100000,{minPercent:20.01,maxPercent:20.01}),20010);
 for(const balance of [0,1])assert.throws(()=>balancePricedAmount(balance,{minPercent:20,maxPercent:75}),e=>e.status===409);
 assert.equal(balancePricedAmount(2,{minPercent:20,maxPercent:75}),1);
});
test('balance-based reveals persist, use current available money, preserve overrides and lock quotes',async()=>{
 const s=createStore(':memory:');try{
  const auth=createCreatorAuth(s,4997),scope=createOperatorScope(s),op={id:'super',role:'super',username:'balance-qa'};createStageEnrollments(s,scope);const config=createPlanDispatch(s,scope),draw=createStageDispatch(s),copyright=createThirdCopyright(s),invite=auth.createInvite('balance-qa',{});
  const u=(await auth.register({headers:{},socket:{remoteAddress:'balance-qa'}},{email:'balance-percent@example.invalid',password:'BalanceTest2026!',inviteCode:invite.code})).user;
  s.db.prepare("INSERT INTO stage_enrollments(id,user_id,status,created_at) VALUES('balance-approval',?,'approved',?)").run(u.id,new Date().toISOString());s.setCommissionRate('5');s.createTask({title:'Murder at 30,000 Feet',description:'Balance fixture',stage:3,platform:'TikTok',language:'英文',genre:'剧情',deposit:'1',posts:1,episodes:1,slots:100,cover:'/art/hero-v2.webp'});
  const post=(kind,amount,key)=>{const available=s.asUser(u.id,()=>s.summary().wallet.available);s.db.prepare('INSERT INTO ledger(kind,amount,balance_after,note,operation_key,created_at,owner_id) VALUES(?,?,?,?,?,?,?)').run(kind,amount,available+amount,'Isolated balance test',key,new Date().toISOString(),u.id);};
  post('deposit',99900,'balance-topup');post('withdraw_hold',-10000,'balance-withdrawal');
  const slots={2:{premium:true},3:{premium:false,amount:'17.33',rate:'3.25'}};
  config.save(op,u.id,{planDay:1,revision:0,standard:{amount:'999',rate:'3.50'},slots,balancePricing:{minPercent:20,maxPercent:75}});
  const q=draw.draw(u.id,3);assert.equal(q.task.balance_pricing.availableCents,90000);assert.ok(q.task.deposit>=18000&&q.task.deposit<=67500);assert.equal(q.task.commission_rate_bps,350);
  const held=s.asUser(u.id,()=>s.summary().wallet.available);assert.equal(held,90000-q.task.deposit);post('deposit',100000,'balance-after-reveal');
  config.save(op,u.id,{planDay:1,revision:1,standard:null,slots,balancePricing:{minPercent:30,maxPercent:60}});assert.equal(draw.draw(u.id,3).task.deposit,q.task.deposit);assert.equal(draw.pending(u.id).task.balance_pricing.availableCents,90000);
  const complete=offer=>{const a=draw.accept(u.id,offer.id,{amount:offer.task.deposit,commission:offer.task.commission,rateBps:offer.task.commission_rate_bps});copyright.complete(u.id,{assignmentId:a.id,code:copyright.snapshot(u.id,a.id).code});};complete(q);
  const before=s.asUser(u.id,()=>s.summary().wallet.available),premium=draw.draw(u.id,3);assert.equal(premium.task.premium,1);assert.equal(premium.task.balance_pricing.availableCents,before);assert.ok(premium.task.deposit>=Math.ceil(before*.3)&&premium.task.deposit<=Math.floor(before*.6));complete(premium);
  const override=draw.draw(u.id,3);assert.equal(override.task.deposit,1733);assert.equal(override.task.balance_pricing,undefined);assert.equal(override.task.commission_rate_bps,325);
  config.save(op,u.id,{planDay:2,revision:0,standard:null,slots:{},balancePricing:{minPercent:20.25,maxPercent:74.99}});assert.deepEqual(createPlanDispatch(s,scope).list(op,u.id).plans[1].configuration.balancePricing,{minPercent:20.25,maxPercent:74.99});
 }finally{s.close();}
});
