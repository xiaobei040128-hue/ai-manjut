import test from 'node:test';
import assert from 'node:assert/strict';
import {customerDirectory} from '../server/customer-directory.mjs';
import {directoryFixture} from './helpers/customer-directory-fixture.mjs';

test('single-customer reads hydrate only the target and retain exact counts, progress and wallet totals',()=>{
 const f=directoryFixture(160);try{
  const expected=customerDirectory(f.store,f.auth,f.scope,f.superOperator).find(u=>u.id===f.ids[0]),calls=[];
  const auth={users(owners){calls.push(owners);return f.auth.users(owners);}},scope={...f.scope,users(){throw Error('Single-customer detail must not enumerate every customer');}};
  const [actual]=customerDirectory(f.store,auth,scope,f.superOperator,'all',f.ids[0]);
  assert.deepEqual(actual,expected);assert.deepEqual(calls,[[f.ids[0]]]);assert.equal(actual.wallet.available,10000);assert.equal(actual.wallet.held,3000);assert.equal(actual.wallet.total,13000);assert.equal(actual.counts.active,1);assert.equal(actual.progress.currentTask,'Test work');
  assert.deepEqual(customerDirectory(f.store,auth,scope,f.superOperator,'all','missing'),[]);
  for(const id of ['',null,1,{}])assert.throws(()=>customerDirectory(f.store,auth,scope,f.superOperator,'all',id),e=>e.status===400);
 }finally{f.close();}
});
test('targeted customer access enforces current agent ownership, including reassignment and SQL-like identifiers',()=>{
 const f=directoryFixture();try{
  const own=f.ids[0],foreign=f.ids[1];assert.equal(customerDirectory(f.store,f.auth,f.scope,f.agent,'all',own)[0].id,own);
  for(const id of [foreign,'missing',"' OR 1=1 --",null,1])assert.throws(()=>f.scope.assertUser(f.agent,id),e=>e.status===403);
  assert.throws(()=>customerDirectory(f.store,f.auth,f.scope,f.agent,'all',foreign),e=>e.status===403);
  const list=customerDirectory(f.store,f.auth,f.scope,f.agent);assert.equal(list.length,20);assert.ok(list.every(row=>Number(row.id.split('-').at(-1))%2===0));
  assert.ok(customerDirectory(f.store,f.auth,f.scope,f.agent,'test').every(row=>row.customer_type==='test'));
  f.db.prepare('UPDATE invitations SET owner_id=? WHERE id=?').run('detail-agent-b',f.invites[0].id);
  assert.throws(()=>customerDirectory(f.store,f.auth,f.scope,f.agent,'all',own),e=>e.status===403);assert.deepEqual(customerDirectory(f.store,f.auth,f.scope,f.agent),[]);
 }finally{f.close();}
});
test('detail wallet includes current reservations and optional historical holds without leaking another customer',()=>{
 const f=directoryFixture();try{
  f.db.exec('CREATE TABLE newcomer_cover_orders(owner_id TEXT,amount INTEGER,state TEXT);CREATE TABLE community_license_orders(owner_id TEXT,amount INTEGER,state TEXT)');
  for(const table of ['newcomer_cover_orders','community_license_orders']){
   f.db.prepare('INSERT INTO '+table+' VALUES(?,?,?)').run(f.ids[0],300,'purchased');f.db.prepare('INSERT INTO '+table+' VALUES(?,?,?)').run(f.ids[1],999999,'purchased');
  }
  f.db.prepare('INSERT INTO task_balance_reservations(owner_id,kind,reference_id,amount,state,created_at) VALUES(?,?,?,?,?,?)').run(f.ids[0],'fixture','detail-reserved',400,'reserved','2026-11-01');
  const [row]=customerDirectory(f.store,f.auth,f.scope,f.superOperator,'all',f.ids[0]);assert.equal(row.wallet.taskHeld,2000);assert.equal(row.wallet.withdrawalHeld,2000);assert.equal(row.wallet.held,4000);assert.equal(row.wallet.total,14000);
  assert.deepEqual(row,customerDirectory(f.store,f.auth,f.scope,f.superOperator).find(u=>u.id===f.ids[0]));
 }finally{f.close();}
});
