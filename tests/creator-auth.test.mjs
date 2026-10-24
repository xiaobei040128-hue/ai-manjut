import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from './fixtures/store.mjs';
import {createCreatorAuth} from '../server/creator-auth.mjs';
const request=()=>({headers:{},socket:{remoteAddress:Math.random().toString()}});
test('permanent short invitations allow repeat registration and hash credentials',async()=>{
 const store=createStore(':memory:'),auth=createCreatorAuth(store,4911);
 try{const invite=auth.createInvite('admin',{maxUses:1,days:1}),input={email:'Creator@Example.com',password:'Test1234',inviteCode:invite.code};
  await assert.rejects(auth.register(request(),{...input,password:'Test123'}),e=>e.status===400);
  const results=await Promise.allSettled([auth.register(request(),input),auth.register(request(),{...input,email:'other@example.com'})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,2);
  assert.equal(auth.invitations()[0].used,2);assert.equal(auth.users().length,2);
  const row=store.db.prepare('SELECT * FROM creator_accounts').get();assert.notEqual(row.password_hash,input.password);assert.equal(row.password_hash.length,128);
  assert.match(invite.code,/^[A-Z2-9]{8}$/);assert.ok(!JSON.stringify(store.auditLog()).includes(invite.code));assert.ok(!JSON.stringify(store.auditLog()).includes(input.password));
  const login=await auth.login(request(),{email:row.email.toUpperCase(),password:input.password});const req=request();req.headers.cookie=auth.cookie(login.token).split(';')[0];assert.equal(auth.current(req).id,row.id);auth.logout(req);assert.equal(auth.current(req),null);
  await assert.rejects(auth.login(request(),{email:row.email,password:'wrong-password'}),e=>e.status===401);
  const disabled=auth.createInvite('admin',{});auth.revoke('admin',disabled.id);await assert.rejects(auth.register(request(),{...input,email:'disabled@example.com',inviteCode:disabled.code}));
  const expired=auth.createInvite('admin',{});store.db.prepare("UPDATE invitations SET expires_at='2000-01-01' WHERE id=?").run(expired.id);assert.ok((await auth.register(request(),{...input,email:'expired@example.com',inviteCode:expired.code})).user.id);
 }finally{store.close();}
});
test('creator state is isolated while task capacity and admin views remain shared',async()=>{
 const s=createStore(':memory:'),a=createCreatorAuth(s,4912),invite=a.createInvite('admin',{maxUses:2});
 try{const first=(await a.register(request(),{email:'one@example.com',password:'Test-Password-2026!',inviteCode:invite.code})).user,second=(await a.register(request(),{email:'two@example.com',password:'Test-Password-2026!',inviteCode:invite.code})).user;
  for(const u of [first,second]){assert.equal(s.asUser(u.id,()=>s.summary()).wallet.available,0);s.db.prepare("INSERT INTO ledger(kind,amount,balance_after,note,operation_key,created_at,owner_id) VALUES('credit',200000,200000,'Explicit test fixture',?,?,?)").run('fixture:'+u.id,new Date().toISOString(),u.id);}
  const one=s.asUser(first.id,()=>s.claim('secret-wife')),two=s.asUser(second.id,()=>s.claim('secret-wife'));assert.notEqual(one.id,two.id);
  s.asUser(first.id,()=>{assert.throws(()=>s.assignment(two.id),e=>e.status===404);assert.throws(()=>s.saveDraft(two.id,{note:'stolen'}));s.bookmark('secret-wife');s.profile({name:'First creator'});const data=s.summary();assert.equal(data.assignments.length,1);assert.equal(data.assignments[0].id,one.id);assert.equal(data.profile.name,'First creator');assert.equal(data.wallet.available,170000);});
  s.asUser(second.id,()=>{const data=s.summary();assert.equal(data.bookmarks.length,0);assert.notEqual(data.profile.name,'First creator');assert.equal(data.tasks.find(t=>t.id==='secret-wife').remaining,34);assert.equal(data.wallet.available,170000);s.cancel(two.id);assert.equal(s.summary().wallet.available,200000);});
  assert.equal(s.summary().assignments.length,2);assert.equal(s.asUser(first.id,()=>s.summary()).wallet.available,170000);
  const otherNotice=s.asUser(second.id,()=>s.summary()).notifications[0];assert.throws(()=>s.asUser(first.id,()=>s.readNotifications(otherNotice.id)),e=>e.status===404);
 }finally{s.close();}
});
