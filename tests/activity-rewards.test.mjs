import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createStore} from '../server/store.mjs';
import {createCreatorAuth} from '../server/creator-auth.mjs';
import {createAdminAuth} from '../server/auth.mjs';
import {createFinance} from '../server/finance.mjs';
import {createOperatorScope} from '../server/operators.mjs';
import {createActivityRewards} from '../server/activity-rewards.mjs';
test('activity rewards enforce budgets, fixed amounts, operator scope and once-only audited ledger posting',async()=>{
 await mkdir(resolve('work'),{recursive:true});
 const dir=await mkdtemp(resolve('work/activity-test-'));const s=createStore(join(dir,'workspace.sqlite'));
 try {
  const admin=createAdminAuth(s,4991);admin.setup({username:'reward-admin',password:'RewardQA123'});
  const a=admin.createAgent('reward-admin',{username:'reward-agent-a',password:'RewardQA123'}),b=admin.createAgent('reward-admin',{username:'reward-agent-b',password:'RewardQA123'});
  const superOp={id:'super',username:'reward-admin',role:'super'},agent={id:a.id,username:a.username,role:'agent'},other={id:b.id,username:b.username,role:'agent'};
  const auth=createCreatorAuth(s,4991),finance=createFinance(s,dir),scope=createOperatorScope(s),rewards=createActivityRewards(s,scope);
  const invite=auth.createInvite(a.username,{},a.id),inviteB=auth.createInvite(b.username,{},b.id),req={headers:{},socket:{remoteAddress:'qa'}};
  async function user(email,code=invite.code){return (await auth.register(req,{email,password:'RewardQA123',inviteCode:code})).user.id;}
  const u1=await user('reward-one@example.com'),u2=await user('reward-two@example.com'),u3=await user('reward-three@example.com'),foreign=await user('reward-foreign@example.com',inviteB.code);
  const balance=id=>s.asUser(id,()=>s.summary().wallet.available);
  assert.equal(balance(u1),0);
  assert.throws(()=>rewards.create(agent,{name:'禁止创建',amount:'1',budget:'10',operatorId:a.id}),e=>e.status===403);
  assert.throws(()=>scope.guard(agent,'/api/admin/finance/account/'+u1+'/adjust','POST'),e=>e.status===403);
  const c=rewards.create(superOp,{name:'读者评价活动',amount:'1.25',budget:'2.50',operatorId:a.id});
  const input={userId:u1,reason:'已核对活动参与记录',confirm:true,operationKey:randomUUID(),amount:'999'};
  assert.throws(()=>rewards.grant(other,c.id,input),e=>e.status===403);
  assert.throws(()=>rewards.grant(agent,c.id,{...input,userId:foreign}),e=>e.status===403);
  assert.throws(()=>rewards.grant(agent,c.id,{...input,confirm:false}));
  assert.deepEqual(rewards.snapshot(other).campaigns,[]);
  const receipt=rewards.grant(agent,c.id,input);assert.equal(receipt.amount,125);assert.equal(balance(u1),125);
  assert.equal(rewards.grant(agent,c.id,input).id,receipt.id);assert.equal(balance(u1),125);
  assert.throws(()=>rewards.grant(agent,c.id,{...input,reason:'不同的发放原因'}),e=>e.status===409);
  assert.throws(()=>rewards.grant(agent,c.id,{...input,operationKey:randomUUID()}),e=>e.status===409);
  finance.freeze('reward-admin',u2,{frozen:true,reason:'QA freeze customer'});
  assert.throws(()=>rewards.grant(agent,c.id,{...input,userId:u2,operationKey:randomUUID()}),e=>e.status===403);
  finance.freeze('reward-admin',u2,{frozen:false,reason:'QA unfreeze customer'});
  rewards.state(superOp,c.id,{active:false});assert.throws(()=>rewards.grant(agent,c.id,{...input,userId:u2,operationKey:randomUUID()}),e=>e.status===409);rewards.state(superOp,c.id,{active:true});
  // An audit failure must roll back grant, wallet entry and notification together.
  s.db.exec("CREATE TRIGGER fail_activity_audit BEFORE INSERT ON admin_audit WHEN NEW.action='activity.grant' BEGIN SELECT RAISE(ABORT,'QA forced audit failure'); END;");
  const second={...input,userId:u2,operationKey:randomUUID()};assert.throws(()=>rewards.grant(agent,c.id,second));assert.equal(balance(u2),0);assert.equal(rewards.snapshot(superOp).grants.length,1);
  s.db.exec('DROP TRIGGER fail_activity_audit');rewards.grant(agent,c.id,second);assert.equal(balance(u2),125);
  assert.throws(()=>rewards.grant(agent,c.id,{...input,userId:u3,operationKey:randomUUID()}),e=>e.status===409);
  assert.equal(rewards.snapshot(agent).campaigns[0].spent,250);assert.equal(rewards.snapshot(other).grants.length,0);
  const ledger=s.db.prepare("SELECT * FROM ledger WHERE kind='activity_reward'").all();assert.equal(ledger.length,2);assert.ok(ledger.every(l=>l.balance_after===125));
  assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE owner_id=?').get(u1).n>0,true);
  assert.ok(s.auditLog().some(a=>a.action==='activity.grant'&&a.actor===agent.username&&a.detail.campaignId===c.id));
 } finally {s.close();await rm(dir,{recursive:true,force:true});}
});
