import test from 'node:test';import assert from 'node:assert/strict';import {createStore} from '../server/store.mjs';import {createCreatorAuth} from '../server/creator-auth.mjs';import {personalInvite} from '../server/referrals.mjs';
test('email compatibility, normalized international phone registration/login, duplicate guard, invitations, unverified status and password change',async()=>{const s=createStore(':memory:');try{const auth=createCreatorAuth(s,4961),req={headers:{},socket:{remoteAddress:'qa'}},invite=auth.createInvite('qa',{},'super'),parent=await auth.register(req,{email:'EMAIL@example.invalid',password:'TestDaily123!',inviteCode:invite.code});assert.equal((await auth.login(req,{email:'email@example.invalid',password:'TestDaily123!'})).user.id,parent.user.id);const p=await auth.register(req,{account:'+1 (202) 555-0182',password:'TestDaily123!',inviteCode:personalInvite(s.db,parent.user.id)});assert.equal(p.user.email,'+12025550182');assert.equal(p.user.emailVerified,false);const login=await auth.login(req,{account:'+1202 5550182',password:'TestDaily123!'});assert.equal(login.user.id,p.user.id);assert.equal(login.user.phoneVerified,false);assert.equal(login.user.phone,'+12025550182');await assert.rejects(auth.register(req,{account:'+1-202-555-0182',password:'TestDaily123!',inviteCode:invite.code}),e=>e.status===409);assert.equal(s.db.prepare('SELECT parent_id FROM referral_links WHERE child_id=?').get(p.user.id).parent_id,parent.user.id);const cookie={headers:{cookie:auth.cookie(login.token).split(';')[0]}};await auth.changeOwnPassword(cookie,{currentPassword:'TestDaily123!',newPassword:'ChangedDaily123!',confirmPassword:'ChangedDaily123!'});assert.equal((await auth.login(req,{account:'+12025550182',password:'ChangedDaily123!'})).user.id,p.user.id);
}finally{s.close();}});

test('username login is case insensitive, unique, validated and compatible with old email and phone accounts',async()=>{
 const s=createStore(':memory:');try{const auth=createCreatorAuth(s,4962),invite=auth.createInvite('qa',{}),req=n=>({headers:{},socket:{remoteAddress:'username-'+n}}),password='TestDaily123!';
 const a=await auth.register(req(1),{username:'Creator_42',email:'username@example.invalid',password,inviteCode:invite.code});assert.equal(a.user.username,'Creator_42');
 for(const account of ['Creator_42','CREATOR_42','username@example.invalid'])assert.equal((await auth.login(req(2),{account,password})).user.id,a.user.id);
 assert.equal(auth.current({headers:{cookie:auth.cookie(a.token).split(';')[0]}}).username,'Creator_42');
 await assert.rejects(auth.register(req(3),{username:'creator_42',email:'different@example.invalid',password,inviteCode:invite.code}),e=>e.status===409);
 for(const [index,username] of ['\u5f20\u4e09','12user','a b','a@b.com','ab','a'.repeat(33)].entries()){
  const user=await auth.register(req('register'+index),{username,email:'unicode'+index+'@example.invalid',password,inviteCode:invite.code});
  assert.equal((await auth.login(req('login'+index),{account:username,password})).user.id,user.user.id);
 }
 await assert.rejects(auth.register(req('empty'),{username:' ',email:'invalid@example.invalid',password,inviteCode:invite.code}));
 const phone=await auth.register(req(4),{username:'PhoneUser',account:'+12025550198',password,inviteCode:invite.code});assert.equal((await auth.login(req(5),{account:'phoneuser',password})).user.id,phone.user.id);assert.equal((await auth.login(req(6),{account:'+1 (202) 555-0198',password})).user.id,phone.user.id);
 await assert.rejects(auth.login(req(7),{account:'creator_42',password:'WrongPass123!'}),e=>e.status===401);
 }finally{s.close();}
});
