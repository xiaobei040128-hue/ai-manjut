import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createStore} from '../server/store.mjs';
import {createCreatorAuth} from '../server/creator-auth.mjs';
import {createFinance} from '../server/finance.mjs';
import {createDepositChannels} from '../server/deposit-channels.mjs';
test('deposit channel configuration persists, blocks unavailable routes and records selected details without crediting funds',async()=>{
 const dir=await mkdtemp(resolve('work/deposit-channels-')),store=createStore(join(dir,'workspace.sqlite'));
 try{const auth=createCreatorAuth(store,4977),finance=createFinance(store,dir),settings=createDepositChannels(store),invite=auth.createInvite('qa',{},'super'),user=(await auth.register({headers:{},socket:{remoteAddress:'127.0.0.1'}},{email:'channels@audit.invalid',password:'ChannelsTest123!',inviteCode:invite.code})).user;
 const original=settings.snapshot();assert.equal(original.channels.length,9);
 for(const depositChannel of ['visa','mastercard','bogus','bitcoin'])assert.throws(()=>finance.apply(user.id,{kind:'deposit',amount:'20',reference:randomUUID(),operationKey:randomUUID(),depositChannel}));
 const configured={...original,channels:original.channels.map(c=>({...c,account:['visa','mastercard'].includes(c.id)?'':'QA-ONLY-'+c.id,instructions:'测试收款说明'}))};
 const saved=settings.save('qa',configured);assert.equal(saved.revision,1);assert.throws(()=>settings.save('qa',configured),e=>e.status===409);
 assert.equal(createDepositChannels(store).snapshot().channels[0].account,'QA-ONLY-binance');
 const balance=finance.snapshot(user.id).account.available;
 for(const c of saved.channels.filter(c=>c.enabled&&c.id!=='bank_wire')){const input={kind:'deposit',amount:'12.34',reference:randomUUID(),operationKey:randomUUID(),depositChannel:c.id},row=finance.apply(user.id,input);assert.equal(row.deposit_channel,c.id);assert.equal(row.deposit_channel_name,c.name);assert.equal(finance.apply(user.id,input).id,row.id);assert.throws(()=>finance.apply(user.id,{...input,depositChannel:c.id==='usdt'?'usdc':'usdt'}),e=>e.status===409);}
 assert.equal(finance.snapshot(user.id).account.available,balance);
 assert.throws(()=>settings.save('qa',{...saved,channels:saved.channels.slice(1)}));
 assert.equal(finance.admin().requests.filter(r=>r.deposit_channel).length,6);
 }finally{store.close();await rm(dir,{recursive:true,force:true});}
});
