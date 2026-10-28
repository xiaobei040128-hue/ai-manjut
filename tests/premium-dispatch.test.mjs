import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createStore} from '../server/store.mjs';
import {createAdminAuth} from '../server/auth.mjs';
import {createCreatorAuth} from '../server/creator-auth.mjs';
import {createFinance} from '../server/finance.mjs';
import {createOperatorScope} from '../server/operators.mjs';
import {createStageEnrollments} from '../server/stage-enrollments.mjs';
import {createPremiumDispatch} from '../server/premium-dispatch.mjs';
test('premium triggers are per-customer, multiple, opt-in, immutable after claim and isolated by agent',async()=>{
 await mkdir(resolve('work'),{recursive:true});const dir=await mkdtemp(resolve('work/dispatch-')),s=createStore(join(dir,'workspace.sqlite'));
 try{
  const admin=createAdminAuth(s,4967);admin.setup({username:'dispatch-admin',password:'DispatchQA123!'});const agentA={...admin.createAgent('dispatch-admin',{username:'dispatch-agent-a',password:'DispatchQA123!'}),role:'agent'},agentB={...admin.createAgent('dispatch-admin',{username:'dispatch-agent-b',password:'DispatchQA123!'}),role:'agent'},superOp={id:'super',role:'super',username:'dispatch-admin'};
  const auth=createCreatorAuth(s,4967),finance=createFinance(s,dir),scope=createOperatorScope(s);createStageEnrollments(s,scope);const service=createPremiumDispatch(s,scope);s.setCommissionRate('5');
  async function user(email,agent){const invite=auth.createInvite(agent.username,{},agent.id),u=(await auth.register({headers:{},socket:{remoteAddress:email}},{email,password:'DispatchQA123!',inviteCode:invite.code})).user;s.db.prepare("INSERT INTO stage_enrollments(id,user_id,status,created_at) VALUES(?,?,'approved',?)").run('enrollment-'+u.id,u.id,new Date().toISOString());finance.adjust('dispatch-admin',u.id,{direction:'credit',amount:'500',note:'Isolated dispatch fixture',operationKey:'funding-'+u.id});return u;}
  const a=await user('dispatch-a@example.invalid',agentA),b=await user('dispatch-b@example.invalid',agentB),a2=await user('dispatch-a2@example.invalid',agentA);
  const task=s.createTask({stage:3,premium:true,title:'客户派发测试',description:'作品任务',platform:'TikTok',language:'中文',genre:'剧情',deposit:10,posts:1,episodes:1,slots:100,cover:'/art/hero-v2.webp'}),quote={amount:task.deposit,commission:task.commission,rateBps:task.commission_rate_bps},day=service.list(superOp).day;
  const initial=service.list(superOp).customers.find(c=>c.id===a.id);assert.equal(initial.progress.stage,3);assert.equal(initial.progress.planDay,1);assert.equal(initial.progress.dailyClaimed,0);assert.equal(s.db.prepare('SELECT COUNT(*) n FROM third_plans').get().n,0);
  assert.equal(task.premium,0);assert.deepEqual(service.list(agentA).customers.map(c=>c.id).sort(),[a.id,a2.id].sort());assert.equal(service.list(agentB).customers.length,1);
  assert.throws(()=>service.save(agentA,b.id,{day,revision:0,sequences:[1]}),e=>e.status===403);
  assert.throws(()=>service.save(superOp,a.id,{day:'2000-01-01',revision:0,sequences:[1]}),e=>e.status===409);
  for(const sequences of [[0],[11],[21],[1,1],['2']])assert.throws(()=>service.save(agentA,a.id,{day,revision:0,sequences}));
  for(const terms of [{1:{amount:'0',rate:'3'}},{1:{amount:'100',rate:'101'}},{1:{amount:'1.234',rate:'3'}},{2:{amount:'100',rate:'3'}}])assert.throws(()=>service.save(agentA,a.id,{day,revision:0,sequences:[1],terms}));
  let revision=service.save(agentA,a.id,{day,revision:0,sequences:[1,3]}).revision;service.save(agentB,b.id,{day,revision:0,sequences:[2]});
  assert.throws(()=>service.save(agentA,a.id,{day,revision:0,sequences:[2]}),e=>e.status===409);
  function claim(u){return s.asUser(u.id,()=>s.claim(task.id,quote));}function cancel(u,id){return s.asUser(u.id,()=>s.cancel(id));}
  const first=claim(a);assert.equal(first.task.premium,1);assert.equal(first.task.dispatch_sequence,1);assert.equal(claim(a).id,first.id);assert.equal(service.list(agentA).customers.find(c=>c.id===a.id).claimedThrough,1);
  assert.throws(()=>service.save(agentA,a.id,{day,revision,sequences:[3]}),e=>e.status===409);
  revision=service.save(agentA,a.id,{day,revision,sequences:[1,3,5]}).revision;cancel(a,first.id);
  const second=claim(a);assert.equal(second.task.premium,0);assert.equal(second.task.dispatch_sequence,2);cancel(a,second.id);
  const third=claim(a);assert.equal(third.task.premium,1);assert.equal(third.task.dispatch_sequence,3);cancel(a,third.id);
  revision=service.save(agentA,a.id,{day,revision,sequences:[1,3]}).revision;
  assert.equal(s.asUser(a.id,()=>s.assignment(first.id)).task.premium,1);
  const bfirst=claim(b);assert.equal(bfirst.task.premium,0);cancel(b,bfirst.id);const bsecond=claim(b);assert.equal(bsecond.task.premium,1);
  s.db.prepare('INSERT INTO premium_dispatch_policy VALUES(?,?,?,?,?,?)').run(a2.id,'2000-01-01','[1]',1,'fixture',new Date().toISOString());
  const unset=claim(a2);assert.equal(unset.task.premium,0);assert.equal(unset.task.dispatch_sequence,1);
  finance.adjust('dispatch-admin',a2.id,{direction:'debit',amount:'490',note:'Insufficient balance test',operationKey:'drain-'+a2.id});cancel(a2,unset.id);finance.adjust('dispatch-admin',a2.id,{direction:'debit',amount:'10',note:'Drain refunded amount',operationKey:'drain-refund-'+a2.id});
  assert.throws(()=>claim(a2),e=>e.status===409);assert.equal(service.list(agentA).customers.find(c=>c.id===a2.id).claimedThrough,1);
  for(let n=4;n<=20;n++){const assignment=claim(a);assert.equal(assignment.task.dispatch_sequence,n);assert.equal(assignment.task.premium,0);cancel(a,assignment.id);}
  const retry=claim(a);assert.equal(retry.task.dispatch_sequence,21);assert.equal(s.asUser(a.id,()=>s.dispatchStatus()).completed,0);cancel(a,retry.id);
  assert.equal(service.list(agentB).customers[0].claimedThrough,2);
 }finally{s.close();}
});
