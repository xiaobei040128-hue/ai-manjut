import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createStore} from './fixtures/store.mjs';
import {createCreatorAuth} from '../server/creator-auth.mjs';
import {createAdminAuth} from '../server/auth.mjs';
import {createFinance} from '../server/finance.mjs';
import {createOperatorScope} from '../server/operators.mjs';
import {customerDirectory} from '../server/customer-directory.mjs';
import {customerOverview} from '../server/customer-overview.mjs';

test('customer classification persists, filters within agent ownership, validates input and leaves funds unchanged',async()=>{
 const dir=await mkdtemp(join(resolve('work'),'customer-type-')),path=join(dir,'workspace.sqlite');let store=createStore(path);
 try{const admin=createAdminAuth(store,4990);admin.setup({username:'types-super',password:'TypeTesting123!'});const agent=admin.createAgent('types-super',{username:'types-agent',password:'TypeTesting123!'}),op={id:agent.id,role:'agent',username:'types-agent'},auth=createCreatorAuth(store,4990),scope=createOperatorScope(store);createFinance(store,dir);
 const owned=auth.createInvite('types-agent',{},op.id),other=auth.createInvite('types-super',{}),req={headers:{},socket:{remoteAddress:'type-test'}};
 const a=(await auth.register(req,{email:'type-owned@example.invalid',password:'TypeTesting123!',inviteCode:owned.code})).user,b=(await auth.register(req,{email:'type-other@example.invalid',password:'TypeTesting123!',inviteCode:other.code})).user;
 assert.equal(auth.users().find(u=>u.id===a.id).customer_type,'real');const funds=store.db.prepare('SELECT SUM(amount) n FROM ledger WHERE owner_id=?').get(a.id).n;
 auth.updateCustomerType(op.username,a.id,{customerType:'test'});assert.equal(customerDirectory(store,auth,scope,op,'test').length,1);assert.equal(customerDirectory(store,auth,scope,op,'real').length,0);
 assert.throws(()=>scope.guard(op,'/api/admin/accounts/'+b.id+'/customer-type','POST'),e=>e.status===403);scope.guard(op,'/api/admin/accounts/'+a.id+'/customer-type','POST');
 assert.throws(()=>auth.updateCustomerType(op.username,a.id,{customerType:'unknown'}),e=>e.status===400);assert.throws(()=>customerDirectory(store,auth,scope,op,'unknown'),e=>e.status===400);
 assert.equal(store.db.prepare('SELECT SUM(amount) n FROM ledger WHERE owner_id=?').get(a.id).n,funds);assert.ok(store.auditLog().some(r=>r.action==='customer.type'&&r.detail.before==='real'&&r.detail.after==='test'));
 store.close();store=createStore(path);const restored=createCreatorAuth(store,4990);assert.equal(restored.users().find(u=>u.id===a.id).customer_type,'test');assert.equal(store.db.prepare('SELECT SUM(amount) n FROM ledger WHERE owner_id=?').get(a.id).n,funds);
 }finally{store.close();await rm(dir,{recursive:true,force:true});}
});

test('overview separates real/test, scopes agents, uses Beijing day and excludes pending deposits and unpaid withdrawals',async()=>{
 const dir=await mkdtemp(join(resolve('work'),'overview-')),store=createStore(':memory:');try{
 const admin=createAdminAuth(store,4989);admin.setup({username:'overview-super',password:'Overview123!'});const agent=admin.createAgent('overview-super',{username:'overview-agent',password:'Overview123!'}),op={id:agent.id,role:'agent',username:'overview-agent'},auth=createCreatorAuth(store,4989);createFinance(store,dir);
 const own=auth.createInvite('overview-agent',{},op.id),other=auth.createInvite('overview-super',{}),req={headers:{},socket:{remoteAddress:'overview-test'}};
 const a=(await auth.register(req,{email:'overview-real@example.invalid',password:'Overview123!',inviteCode:own.code})).user,b=(await auth.register(req,{email:'overview-test@example.invalid',password:'Overview123!',inviteCode:other.code})).user;
 auth.updateCustomerType('overview-super',b.id,{customerType:'test'});store.db.prepare('UPDATE creator_accounts SET created_at=? WHERE id=?').run('2026-10-25T17:00:00Z',a.id);store.db.prepare('UPDATE creator_accounts SET created_at=? WHERE id=?').run('2026-10-25T15:59:59Z',b.id);
 const insert=store.db.prepare('INSERT INTO fund_requests(id,user_id,kind,amount,status,created_at,reviewed_at,paid_at,operation_key) VALUES(?,?,?,?,?,?,?,?,?)');
 insert.run('real-deposit',a.id,'deposit',2000,'completed','2026-10-24T01:00:00Z','2026-10-25T17:00:00Z',null,'real-deposit');
 insert.run('pending-deposit',a.id,'deposit',3000,'review','2026-10-26T00:00:00Z',null,null,'pending-deposit');
 insert.run('paid',a.id,'withdrawal',500,'paid','2026-10-24T01:00:00Z','2026-10-24T01:00:00Z','2026-10-25T17:00:00Z','paid');
 insert.run('paying',a.id,'withdrawal',700,'paying','2026-10-26T00:00:00Z','2026-10-26T00:00:00Z',null,'paying');
 insert.run('test-deposit',b.id,'deposit',10000,'completed','2026-10-26T00:00:00Z','2026-10-26T00:00:00Z',null,'test-deposit');
 const reward=store.db.prepare('INSERT INTO ledger(kind,amount,balance_after,note,operation_key,created_at,owner_id) VALUES(?,?,?,?,?,?,?)');reward.run('reward',250,350,'QA commission','overview-reward','2026-10-25T17:00:00Z',a.id);reward.run('activity_reward',100,450,'QA activity','overview-activity','2026-10-25T17:00:00Z',a.id);
 const now=new Date('2026-10-26T02:00:00Z'),snapshot=customerOverview(store,{id:'super',role:'super'},now);assert.equal(snapshot.today,'2026-10-26');const real=snapshot.groups.real;assert.equal(real.customers,1);assert.equal(real.registeredToday,1);assert.equal(real.todayDeposits,2000);assert.equal(real.totalDeposits,2000);assert.equal(real.todayWithdrawals,500);assert.equal(real.totalWithdrawals,500);assert.equal(real.todayWithdrawalApplications,700);assert.equal(real.pendingDeposits,3000);assert.equal(real.pendingWithdrawals,700);assert.equal(real.todayCommission,250);assert.equal(snapshot.groups.test.totalDeposits,10000);assert.equal(snapshot.groups.test.registeredToday,0);
 const scoped=customerOverview(store,op,now);assert.equal(scoped.groups.test.customers,0);assert.equal(scoped.groups.test.totalDeposits,0);assert.equal(scoped.groups.real.totalDeposits,2000);
 }finally{store.close();await rm(dir,{recursive:true,force:true});}
});
