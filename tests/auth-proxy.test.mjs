import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from './fixtures/store.mjs';
import {createAdminAuth} from '../server/auth.mjs';
import {createCreatorAuth} from '../server/creator-auth.mjs';
const req=(ip,peer='127.0.0.1')=>({headers:{'x-forwarded-for':ip},socket:{remoteAddress:peer}});
async function proxyConfiguration(fn){const names=['DRAMA_TRUST_PROXY','DRAMA_TRUST_PROXY_ADDRESSES'],old=Object.fromEntries(names.map(n=>[n,process.env[n]]));process.env.DRAMA_TRUST_PROXY='1';process.env.DRAMA_TRUST_PROXY_ADDRESSES='127.0.0.1';try{await fn();}finally{for(const n of names)if(old[n]===undefined)delete process.env[n];else process.env[n]=old[n];}}

test('trusted proxy customers have independent admin attempt limits; direct spoofed headers do not bypass limits',()=>proxyConfiguration(async()=>{
 const store=createStore(':memory:');try{
  const auth=createAdminAuth(store,4976);auth.setup({username:'proxy-admin',password:'ProxyAuthQA123!'});
  for(let n=0;n<5;n++)assert.throws(()=>auth.login(req('198.51.100.1'),{username:'proxy-admin',password:'wrong-password'}),e=>e.status===401);
  assert.throws(()=>auth.login(req('198.51.100.1'),{username:'proxy-admin',password:'ProxyAuthQA123!'}),e=>e.status===429);
  assert.ok(auth.login(req('198.51.100.2'),{username:'proxy-admin',password:'ProxyAuthQA123!'}).token);
  for(let n=0;n<5;n++)assert.throws(()=>auth.login(req('192.0.2.'+(n+1),'203.0.113.9'),{username:'proxy-admin',password:'wrong-password'}),e=>e.status===401);
  assert.throws(()=>auth.login(req('192.0.2.100','203.0.113.9'),{username:'proxy-admin',password:'ProxyAuthQA123!'}),e=>e.status===429);
 }finally{store.close();}
}));

test('creator attempts behind a trusted proxy are isolated by validated client address',()=>proxyConfiguration(async()=>{
 const store=createStore(':memory:');try{
  const admin=createAdminAuth(store,4977);admin.setup({username:'creator-proxy-admin',password:'ProxyAuthQA123!'});
  const auth=createCreatorAuth(store,4977),invite=auth.createInvite('creator-proxy-admin',{},'super');
  await auth.register(req('198.51.100.10','10.0.0.1'),{email:'proxy-creator@example.invalid',password:'ProxyAuthQA123!',inviteCode:invite.code});
  for(let n=0;n<10;n++)await assert.rejects(()=>auth.login(req('198.51.100.11'),{email:'proxy-creator@example.invalid',password:'WrongProxyQA!'}),e=>e.status===401);
  await assert.rejects(()=>auth.login(req('198.51.100.11'),{email:'proxy-creator@example.invalid',password:'ProxyAuthQA123!'}),e=>e.status===429);
  assert.equal((await auth.login(req('198.51.100.12'),{email:'proxy-creator@example.invalid',password:'ProxyAuthQA123!'})).user.email,'proxy-creator@example.invalid');
 }finally{store.close();}
}));
