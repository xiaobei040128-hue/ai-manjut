import test from 'node:test';
import assert from 'node:assert/strict';
import {filterCustomers,emptyCustomerFilters,registrationDay} from '../src/admin/customer-filters.ts';
const row=(id,values={})=>({id,name:id,email:id+'@example.invalid',agent_username:'agent',customer_type:'real',identity_status:'approved',frozen:0,pending_cards:0,pending_deposits:0,pending_withdrawals:0,created_at:'2026-10-25T12:00:00+08:00',wallet:{available:100},progress:{stage:3},...values});
test('customer filters combine classification, inclusive registration dates, identity, pending, stage and account status',()=>{
 const a=row('a'),b=row('b',{customer_type:'test',identity_status:'review',frozen:1,created_at:'2026-10-26T00:00:00+08:00',progress:{stage:1}}),c=row('c',{identity_status:'not_submitted',pending_withdrawals:1,created_at:'2026-10-26T23:59:59+08:00',progress:{stage:2}}),rows=[a,b,c];
 assert.equal(registrationDay('2026-10-25T16:00:00Z'),'2026-10-26');
 const pick=extra=>filterCustomers(rows,{...emptyCustomerFilters,...extra}).map(c=>c.id);
 assert.deepEqual(pick({registeredFrom:'2026-10-26',registeredTo:'2026-10-26'}),['b','c']);
 assert.deepEqual(pick({customerType:'real',stage:'2',pending:'withdrawal',account:'normal',registeredFrom:'2026-10-26'}),['c']);
 assert.deepEqual(pick({identity:'approved'}),['a']);assert.deepEqual(pick({pending:'any'}),['b','c']);assert.deepEqual(pick({pending:'none'}),['a']);
 assert.deepEqual(pick({pending:'identity',account:'frozen'}),['b']);assert.deepEqual(pick({customerType:'test',identity:'approved'}),[]);
 assert.deepEqual(pick({registeredFrom:'2026-10-27',registeredTo:'2026-10-26'}),[]);
 assert.deepEqual(pick({sort:'newest'}),['c','b','a']);assert.deepEqual(pick({sort:'oldest'}),['a','b','c']);assert.deepEqual(pick({query:'C@EXAMPLE'}),['c']);
 assert.deepEqual(rows.map(r=>r.id),['a','b','c']);
});
