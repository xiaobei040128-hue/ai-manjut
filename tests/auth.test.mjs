import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from './fixtures/store.mjs';
import {createAdminAuth} from '../server/auth.mjs';
const req=cookie=>({headers:{cookie},socket:{remoteAddress:'test-local'}});
test('admin passwords and sessions are hashed, expire, and revoke',()=>{const store=createStore(':memory:');try{
 const auth=createAdminAuth(store,9999),password='Test1234';
 assert.throws(()=>auth.setup({username:'Admin',password:'Test123'}),e=>e.status===400);
 const setup=auth.setup({username:'Admin',password}),cookie=auth.cookie(setup.token).split(';')[0];
 assert.equal(auth.requireAdmin(req(cookie)),'admin');
 const row=store.db.prepare('SELECT * FROM admin_account').get();assert.notEqual(row.password_hash,password);assert.match(row.password_hash,/^[a-f0-9]{128}$/);
 const session=store.db.prepare('SELECT * FROM admin_sessions').get();assert.notEqual(session.token_hash,setup.token);
 store.db.exec("UPDATE admin_sessions SET expires_at='2000-01-01T00:00:00Z'");assert.equal(auth.state(req(cookie)).authenticated,false);
 const login=auth.login(req(''),{username:'admin',password}),newCookie=auth.cookie(login.token).split(';')[0];auth.logout(req(newCookie));assert.throws(()=>auth.requireAdmin(req(newCookie)),e=>e.status===401);
 assert.throws(()=>auth.setup({username:'other',password}),e=>e.status===409);
}finally{store.close();}});
test('failed logins are limited and audited without recording credentials',()=>{const store=createStore(':memory:');try{const auth=createAdminAuth(store,9998);auth.setup({username:'admin',password:'A-valid-long-password'});for(let i=0;i<5;i++)assert.throws(()=>auth.login(req(''),{username:'admin',password:'Wrong-password'}),e=>e.status===401);assert.throws(()=>auth.login(req(''),{username:'admin',password:'A-valid-long-password'}),e=>e.status===429);assert.equal(store.auditLog().filter(a=>a.action==='auth.login_failed').length,5);assert.ok(!JSON.stringify(store.auditLog()).includes('password'));}finally{store.close();}});
test('an audited operation and its nested state changes roll back together',()=>{const store=createStore(':memory:');try{const before=store.summary().wallet.available;assert.throws(()=>store.audited('admin','test.failure','secret-wife',()=>{store.claim('secret-wife');throw new Error('abort');}),/abort/);assert.equal(store.summary().wallet.available,before);assert.equal(store.summary().assignments.length,0);assert.equal(store.auditLog().length,0);}finally{store.close();}});
