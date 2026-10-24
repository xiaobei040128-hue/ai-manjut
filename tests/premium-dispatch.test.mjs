import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStore} from './fixtures/store.mjs';
import {createAdminAuth} from '../server/auth.mjs';
import {createCreatorAuth} from '../server/creator-auth.mjs';
import {createFinance} from '../server/finance.mjs';
import {createOperatorScope} from '../server/operators.mjs';
import {createPremiumDispatch} from '../server/premium-dispatch.mjs';
test('premium dispatch is scoped, opt-in, locks at reveal, idempotent and ledger independent',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'premium-test-')),store=createStore(join(dir,'workspace.sqlite'));
 try{const admin=createAdminAuth(store,4999);admin.setup({username:'premium-qa',password:'Premium123'});const a=admin.createAgent('premium-qa',{username:'premium-agent',password:'Premium123'}),b=admin.createAgent('premium-qa',{username:'other-agent',password:'Premium123'});const auth=createCreatorAuth(store,4999);createFinance(store,dir);const invitation=auth.createInvite('premium-qa',{},a.id);const user=(await auth.register({headers:{},socket:{remoteAddress:'qa'}},{email:'premium@example.com',password:'Premium123',inviteCode:invitation.code})).user;const scope=createOperatorScope(store),op={...a,role:'agent'},foreign={...b,role:'agent'},service=createPremiumDispatch(store,scope,{access(){}}),day=service.list(op).day;const before=store.db.prepare('SELECT COUNT(*) AS n FROM ledger').get().n;
 assert.equal(service.list(foreign).customers.length,0);assert.throws(()=>service.save(foreign,user.id,{day,sequence:3}),e=>e.status===403);assert.throws(()=>service.save(op,user.id,{day,sequence:21}));assert.throws(()=>service.save(op,user.id,{day:'2000-01-01',sequence:2}),e=>e.status===409);
 assert.equal(service.reveal(user.id,{sequence:1}).premium,false);service.save(op,user.id,{day,sequence:3});assert.equal(service.reveal(user.id,{sequence:2}).premium,false);assert.equal(service.reveal(user.id,{sequence:3}).premium,true);assert.equal(service.reveal(user.id,{sequence:3}).premium,true);assert.throws(()=>service.save(op,user.id,{day,sequence:4}),e=>e.status===409);assert.equal(service.reveal(user.id,{sequence:4}).premium,false);assert.equal(service.list(op).customers[0].revealedThrough,4);assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM ledger').get().n,before);
 }finally{store.close();}
});
