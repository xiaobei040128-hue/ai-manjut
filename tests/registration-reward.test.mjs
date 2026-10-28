import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../server/store.mjs';
import {createCreatorAuth} from '../server/creator-auth.mjs';
const req=()=>({headers:{},socket:{remoteAddress:'127.0.0.1'}});
test('registration grants exactly $1 atomically, while repeated registration and login never grant again',async()=>{
 const store=createStore(':memory:');try{
  const auth=createCreatorAuth(store,4997),invite=auth.createInvite('qa',{},'super'),input={email:'welcome@example.invalid',password:'WelcomeRewardQA123!',inviteCode:invite.code};
  const [first,second]=await Promise.allSettled([auth.register(req(),input),auth.register(req(),input)]);const success=[first,second].find(r=>r.status==='fulfilled'),failure=[first,second].find(r=>r.status==='rejected');assert.ok(success);assert.equal(failure.reason.status,409);
  const result=success.value,id=result.user.id;assert.equal(result.registrationReward.amount,100);assert.equal(store.asUser(id,()=>store.summary()).wallet.available,100);assert.equal(store.asUser(id,()=>store.summary()).wallet.earned,0);
  const rows=store.db.prepare("SELECT * FROM ledger WHERE kind='registration_reward'").all();assert.equal(rows.length,1);assert.equal(rows[0].operation_key,'registration:'+id);assert.equal(rows[0].balance_after,100);assert.equal(store.db.prepare('SELECT used FROM invitations WHERE id=?').get(invite.id).used,1);
  for(let n=0;n<2;n++){const login=await auth.login(req(),input);assert.equal(login.registrationReward,undefined);}assert.equal(store.db.prepare("SELECT COUNT(*) n FROM ledger WHERE kind='registration_reward'").get().n,1);
  const notices=store.asUser(id,()=>store.notifications());assert.equal(notices.notifications.length,1);assert.equal(notices.notifications[0].title,'新手奖励已到账');
  const other=await auth.register(req(),{...input,email:'welcome-other@example.invalid'});assert.equal(store.asUser(other.user.id,()=>store.summary()).wallet.available,100);assert.equal(store.asUser(id,()=>store.summary()).wallet.available,100);
  store.db.exec("CREATE TRIGGER reject_reward BEFORE INSERT ON ledger WHEN NEW.kind='registration_reward' BEGIN SELECT RAISE(ABORT,'isolated reward failure'); END;");
  await assert.rejects(()=>auth.register(req(),{...input,email:'rollback@example.invalid'}));assert.equal(store.db.prepare('SELECT id FROM creator_accounts WHERE email=?').get('rollback@example.invalid'),undefined);assert.equal(store.db.prepare('SELECT used FROM invitations WHERE id=?').get(invite.id).used,2);
 }finally{store.close();}
});
