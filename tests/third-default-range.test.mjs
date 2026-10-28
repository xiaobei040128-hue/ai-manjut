import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../server/store.mjs';
import {createCreatorAuth} from '../server/creator-auth.mjs';
import {createStageEnrollments} from '../server/stage-enrollments.mjs';
import {createOperatorScope} from '../server/operators.mjs';
import {createPlanDispatch} from '../server/plan-dispatch.mjs';
import {createStageDispatch} from '../server/stage-dispatch.mjs';

test('third-stage defaults use arbitrary cents and 3–4 percent for ordinary and premium reveals',async t=>{
 const s=createStore(':memory:');
 try{
  const auth=createCreatorAuth(s,4990),scope=createOperatorScope(s);
  createStageEnrollments(s,scope);
  const config=createPlanDispatch(s,scope),draw=createStageDispatch(s);
  const invite=auth.createInvite('random-default-qa',{maxUses:50,days:1},'super');
  s.setCommissionRate('5'); // Stage three must use its own default, not the global catalog rate.
  s.createTask({title:'Murder at 30,000 Feet',description:'Default range fixture',stage:3,platform:'TikTok',language:'英文',genre:'剧情',deposit:'1',posts:1,episodes:1,slots:100,cover:'/art/hero-v2.webp'});
  const samples=[];
  for(let n=0;n<12;n++){
   const u=(await auth.register({headers:{},socket:{remoteAddress:'qa-'+n}},{email:`default-range-${n}@example.invalid`,password:'RandomDefaultQA123!',inviteCode:invite.code})).user;
   s.db.prepare('INSERT INTO stage_enrollments(id,user_id,status,created_at) VALUES(?,?,?,?)').run('random-approval-'+n,u.id,'approved',new Date().toISOString());
   s.db.prepare("INSERT INTO ledger(kind,amount,balance_after,note,operation_key,created_at,owner_id) VALUES('deposit',1000000,1000100,'Isolated random range funding',?,?,?)").run('random-funding-'+n,new Date().toISOString(),u.id);
   const premium=n%2===1;
   if(premium)config.save({id:'super',role:'super',username:'random-default-qa'},u.id,{planDay:1,revision:0,standard:null,slots:{1:{premium:true}}});
   const q=draw.draw(u.id,3),v=q.task;
   assert.ok(Number.isInteger(v.deposit)&&v.deposit>=20000&&v.deposit<=50000);
   assert.ok(Number.isInteger(v.commission_rate_bps)&&v.commission_rate_bps>=300&&v.commission_rate_bps<=400);
   assert.equal(v.premium,Number(premium));
   assert.equal(v.commission,Math.round(v.deposit*v.commission_rate_bps/10000));
   const repeat=draw.draw(u.id,3);
   assert.equal(repeat.id,q.id);assert.equal(repeat.task.deposit,v.deposit);assert.equal(repeat.task.commission_rate_bps,v.commission_rate_bps);
   samples.push({type:premium?'premium':'ordinary',amount:(v.deposit/100).toFixed(2),rate:(v.commission_rate_bps/100).toFixed(2)+'%'});
  }
  for(const type of ['ordinary','premium']){
   const group=samples.filter(x=>x.type===type);
   assert.ok(group.some(x=>!x.amount.endsWith('.00')));
   assert.ok(new Set(group.map(x=>x.amount)).size>1);
   assert.ok(new Set(group.map(x=>x.rate)).size>1);
  }
  t.diagnostic('DEFAULT_RANGE_SAMPLES '+JSON.stringify(samples));
 }finally{s.close();}
});

