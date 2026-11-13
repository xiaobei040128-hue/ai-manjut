import test from 'node:test';import assert from 'node:assert/strict';
import {createStore} from '../server/store.mjs';import {createCreatorAuth} from '../server/creator-auth.mjs';import {createFinance} from '../server/finance.mjs';import {createStageDispatch} from '../server/stage-dispatch.mjs';import {createThirdCopyright} from '../server/third-copyright.mjs';import {syncStoryTasks} from '../server/sync-story-tasks.mjs';import {personalInvite,referralSummary,saveReferralPolicy,settleReferralRound} from '../server/referrals.mjs';
import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
test('personal registration inherits agent attribution, fixed direct parent, round-only real-commission payment, idempotency and rate snapshots',async()=>{
 const s=createStore(':memory:'),dir=mkdtempSync(join(tmpdir(),'referral-qa-'));try{
 const auth=createCreatorAuth(s,4991),finance=createFinance(s,dir),dispatch=createStageDispatch(s),copyright=createThirdCopyright(s);syncStoryTasks(s);
 const request={headers:{},socket:{remoteAddress:'isolated'}},invite=auth.createInvite('qa',{},'super');
 const register=(email,code)=>auth.register(request,{email,password:'TestDaily123!',inviteCode:code});
 const parent=(await register('parent@example.invalid',invite.code)).user,code=personalInvite(s.db,parent.id);
 assert.equal(personalInvite(s.db,parent.id),code);assert.match(code,/^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{6}$/);assert.match(invite.code,/^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{6}$/);assert.notEqual(code,invite.code);
 const child=(await register('child@example.invalid',code)).user;
 assert.equal(s.db.prepare('SELECT parent_id FROM referral_links WHERE child_id=?').get(child.id).parent_id,parent.id);
 assert.equal(s.db.prepare('SELECT invite_id FROM creator_accounts WHERE id=?').get(child.id).invite_id,invite.id);
 assert.equal(referralSummary(s,parent.id).invitedCount,1);assert.equal(referralSummary(s,child.id).invitedCount,0);
 const grandchild=(await register('grandchild@example.invalid',personalInvite(s.db,child.id))).user;
 finance.adjust('qa',grandchild.id,{direction:'credit',amount:'5000',note:'isolated',operationKey:'referral-seed-grandchild-0001'});
 let sum=0,last;
 for(let i=0;i<50;i++){
  const q=dispatch.draw(grandchild.id,3),a=dispatch.accept(grandchild.id,q.id,{amount:q.task.deposit,commission:q.task.commission,rateBps:q.task.commission_rate_bps}),license=copyright.snapshot(grandchild.id,a.id);sum+=a.task.commission;last={assignmentId:a.id,code:license.code};
  if(i===49)saveReferralPolicy(s,'qa',{revision:0,ratePercent:'7.25'});
  copyright.complete(grandchild.id,last);
  if(i<49)assert.equal(referralSummary(s,child.id).earned,0);
 }
 const expected=Math.round(sum*.0725);assert.equal(referralSummary(s,child.id).earned,expected);assert.equal(referralSummary(s,parent.id).earned,0);
 assert.equal(referralSummary(s,child.id).settlements[0].commission,sum);assert.equal(referralSummary(s,child.id).settlements[0].ratePercent,7.25);
 copyright.complete(grandchild.id,last);assert.equal(settleReferralRound(s,grandchild.id,last.assignmentId),null);assert.equal(referralSummary(s,child.id).earned,expected);
 assert.equal(s.db.prepare("SELECT COUNT(*) n FROM ledger WHERE owner_id=? AND kind='referral_reward'").get(child.id).n,1);
 assert.equal(s.db.prepare("SELECT SUM(amount) n FROM ledger WHERE owner_id=?").get(child.id).n,expected);
 saveReferralPolicy(s,'qa',{revision:1,ratePercent:'0'});assert.equal(referralSummary(s,child.id).settlements[0].ratePercent,7.25);
 assert.throws(()=>saveReferralPolicy(s,'qa',{revision:0,ratePercent:'5'}),e=>e.status===409);
 for(const n of [-1,100.01,'1.001','abc'])assert.throws(()=>saveReferralPolicy(s,'qa',{revision:2,ratePercent:n}));
 assert.equal(s.db.prepare('SELECT reputation_score FROM creator_accounts WHERE id=?').get(child.id).reputation_score,100);
 }finally{s.close();}
});


import {createHash} from 'node:crypto';
import {migrateInviteCodes} from '../server/invite-codes.mjs';
test('mixed invite code migration keeps old admin and personal codes usable, preserves attribution and is idempotent',async()=>{
 const store=createStore(':memory:');try{
  const auth=createCreatorAuth(store,4987),db=store.db,req={headers:{},socket:{remoteAddress:'migration-qa'}},invite=auth.createInvite('qa',{});
  const oldAdmin='123456',hash=createHash('sha256').update(oldAdmin).digest('hex');
  db.prepare('UPDATE invitations SET code=?,code_hash=? WHERE id=?').run(oldAdmin,hash,invite.id);
  const parent=(await auth.register(req,{email:'migration-parent@example.invalid',password:'TestDaily123!',inviteCode:oldAdmin})).user;
  const oldPersonal='654321';db.prepare('UPDATE personal_invites SET code=? WHERE user_id=?').run(oldPersonal,parent.id);
  migrateInviteCodes(db);const admin=auth.invitations()[0],personal=personalInvite(db,parent.id);
  assert.match(admin.code,/^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{6}$/);assert.match(personal,/^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{6}$/);assert.notEqual(admin.code,personal);
  migrateInviteCodes(db);assert.equal(auth.invitations()[0].code,admin.code);assert.equal(personalInvite(db,parent.id),personal);
  for(const [index,code] of [oldAdmin,admin.code.toLowerCase(),oldPersonal,personal.toLowerCase()].entries()){
   const child=(await auth.register(req,{email:`migration-child${index}@example.invalid`,password:'TestDaily123!',inviteCode:code})).user;
   assert.equal(db.prepare('SELECT invite_id FROM creator_accounts WHERE id=?').get(child.id).invite_id,invite.id);
   if(index>=2)assert.equal(db.prepare('SELECT parent_id FROM referral_links WHERE child_id=?').get(child.id).parent_id,parent.id);
  }
  auth.revoke('qa',invite.id);await assert.rejects(auth.register(req,{email:'revoked@example.invalid',password:'TestDaily123!',inviteCode:oldAdmin}));
 }finally{store.close();}
});
