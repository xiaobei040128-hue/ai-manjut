import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createStore} from '../server/store.mjs';
import {createCreatorAuth} from '../server/creator-auth.mjs';
import {createFinance} from '../server/finance.mjs';
import {initializeCustomerClock,rememberCustomerTimeZone} from '../server/customer-clock.mjs';
import {walletOverview} from '../server/wallet-overview.mjs';
test('wallet overview uses settled commission only, account timezone day boundaries and isolated owners',async()=>{
 const dir=await mkdtemp(resolve('work/wallet-overview-')),store=createStore(join(dir,'workspace.sqlite'));
 try{const auth=createCreatorAuth(store,4982),finance=createFinance(store,dir),invite=auth.createInvite('qa',{maxUses:5},'super'),req={headers:{},socket:{remoteAddress:'127.0.0.1'}};
 const register=async email=>(await auth.register(req,{email,password:'WalletAudit2026!',inviteCode:invite.code})).user;const a=await register('wallet-a@audit.invalid'),b=await register('wallet-b@audit.invalid');initializeCustomerClock(store.db);rememberCustomerTimeZone(store.db,a.id,'Asia/Shanghai');rememberCustomerTimeZone(store.db,b.id,'America/New_York');
 function entry(owner,kind,amount,at){store.db.prepare('INSERT INTO ledger(kind,amount,balance_after,note,operation_key,created_at,owner_id) VALUES(?,?,?,?,?,?,?)').run(kind,amount,0,'isolated overview fixture',randomUUID(),at,owner);}
 for(const owner of [a.id,b.id]){entry(owner,'reward',125,'2026-10-26T16:00:00Z');entry(owner,'reward',235,'2026-10-27T00:59:59Z');entry(owner,'reward',99,'2026-10-26T15:59:59Z');entry(owner,'deposit',50000,'2026-10-27T00:10:00Z');entry(owner,'activity_reward',200,'2026-10-27T00:10:00Z');}
 entry(b.id,'reward',900,'2026-10-27T01:00:00Z');const now=new Date('2026-10-27T01:00:00Z');assert.equal(walletOverview(store,a.id,now).todayCommission,360);assert.equal(walletOverview(store,a.id,now).totalCommission,459);assert.equal(walletOverview(store,b.id,now).todayCommission,1359);assert.equal(walletOverview(store,b.id,now).timeZone,'America/New_York');
 const task=store.createTask({title:'Unsettled reward fixture',description:'Test',platform:'TikTok',language:'英文',genre:'悬疑',deposit:'10',commission:'0.5',posts:1,episodes:1,slots:10,stage:3,cover:'/art/hero-v2.webp'});
 const assignment=randomUUID();store.db.prepare("INSERT INTO assignments(id,task_id,status,created_at,deadline,owner_id) VALUES(?,?,'active',?,?,?)").run(assignment,task.id,now.toISOString(),now.toISOString(),a.id);store.db.prepare('INSERT INTO assignment_terms(assignment_id,amount,commission,stage) VALUES(?,?,?,3)').run(assignment,1000,50);
 const available=finance.snapshot(a.id).account.available;assert.equal(finance.snapshot(a.id).hasUnsettledThirdTask,true);assert.equal(finance.snapshot(b.id).hasUnsettledThirdTask,false);assert.equal(finance.snapshot(a.id).account.available,available);
 for(const status of ['review','revision']){store.db.prepare('UPDATE assignments SET status=? WHERE id=?').run(status,assignment);assert.equal(finance.snapshot(a.id).hasUnsettledThirdTask,true);}
 for(const status of ['completed','cancelled']){store.db.prepare('UPDATE assignments SET status=? WHERE id=?').run(status,assignment);assert.equal(finance.snapshot(a.id).hasUnsettledThirdTask,false);}
 const before=finance.snapshot(a.id).account.available;finance.apply(a.id,{kind:'deposit',amount:'25',reference:randomUUID(),operationKey:randomUUID()});assert.equal(finance.snapshot(a.id).account.available,before);assert.equal(walletOverview(store,a.id,now).totalCommission,459);
 entry(a.id,'reward',1,'2026-11-01T04:00:00Z');entry(a.id,'reward',2,'2026-11-01T06:00:00Z');entry(a.id,'reward',4,'2026-11-01T03:59:59Z');rememberCustomerTimeZone(store.db,a.id,'America/New_York');assert.equal(walletOverview(store,a.id,new Date('2026-11-01T07:00:00Z')).todayCommission,3);
 assert.equal(walletOverview(store,a.id,now).processing,store.asUser(a.id,()=>store.summary().wallet.held));assert.equal( finance.snapshot(a.id).overview.totalCommission,466);
 }finally{store.close();await rm(dir,{recursive:true,force:true});}
});
