import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../server/store.mjs';
import {createCreatorAuth} from '../server/creator-auth.mjs';
import {createStageDispatch} from '../server/stage-dispatch.mjs';
const terms=t=>({amount:t.deposit,commission:t.commission,rateBps:t.commission_rate_bps});
test('random offers persist per customer, hide the pool, and freeze only on idempotent acceptance',async()=>{
 const s=createStore(':memory:');try{
  const auth=createCreatorAuth(s,4990),dispatch=createStageDispatch(s),invite=auth.createInvite('qa',{},'super');
  const register=async email=>(await auth.register({headers:{},socket:{remoteAddress:'qa'}},{email,password:'RandomStageQA123!',inviteCode:invite.code})).user;
  const a=await register('random-a@example.invalid'),b=await register('random-b@example.invalid');
  s.setCommissionRate('5');
  const tasks=[1,2,3].map(n=>s.createTask({title:'Hidden task '+n,description:'Private reveal',platform:'TikTok',language:'英文',genre:'Drama',deposit:'0.50',posts:1,episodes:1,slots:20,stage:1,cover:'/art/hero-v2.webp'}));
  const view=id=>s.asUser(id,()=>dispatch.visible(id,s.summary()));
  assert.equal(view(a.id).tasks.length,0);assert.equal(view(b.id).tasks.length,0);
  assert.equal(view(a.id).notifications.some(n=>n.task_id),false);
  const offer=dispatch.draw(a.id,1);
  assert.equal(view(a.id).wallet.available,100);assert.equal(view(a.id).wallet.held,0);
  assert.equal(view(a.id).tasks.length,1);assert.equal(view(b.id).tasks.length,0);
  assert.equal(dispatch.draw(a.id,1).id,offer.id);assert.equal(dispatch.pending(a.id).task.id,offer.task.id);
  assert.throws(()=>dispatch.accept(b.id,offer.id,terms(offer.task)),e=>e.status===404);
  assert.throws(()=>dispatch.acceptTask(a.id,tasks.find(t=>t.id!==offer.task.id).id,terms(offer.task)),e=>e.status===409);
  assert.throws(()=>dispatch.accept(a.id,offer.id,{...terms(offer.task),amount:1}),e=>e.status===409);
  assert.equal(view(a.id).wallet.held,0);assert.equal(dispatch.pending(a.id).id,offer.id);
  s.setCommissionRate('10');assert.throws(()=>dispatch.accept(a.id,offer.id,terms(offer.task)),e=>e.status===409);
  const refreshed=dispatch.pending(a.id),assignment=dispatch.accept(a.id,offer.id,terms(refreshed.task));
  assert.equal(view(a.id).wallet.available,50);assert.equal(view(a.id).wallet.held,50);
  assert.equal(dispatch.accept(a.id,offer.id,terms(refreshed.task)).id,assignment.id);
  assert.equal(s.db.prepare("SELECT COUNT(*) n FROM ledger WHERE operation_key=?").get('claim:'+assignment.id).n,1);
  assert.equal(dispatch.pending(a.id),null);assert.throws(()=>dispatch.draw(a.id,1),e=>e.status===409);
  assert.equal(view(b.id).tasks.length,0);assert.equal(view(b.id).wallet.available,100);
  assert.throws(()=>dispatch.draw(b.id,2),e=>e.status===403);
 }finally{s.close();}
});
