import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {createStore} from './fixtures/store.mjs';
import {createCreatorAuth} from '../server/creator-auth.mjs';
import {createAdminAuth} from '../server/auth.mjs';
import {createFinance} from '../server/finance.mjs';
import {createOperatorScope} from '../server/operators.mjs';
import {customerDirectory} from '../server/customer-directory.mjs';
import {clientMetadata} from '../server/client-metadata.mjs';
import {initializeGeoCountry,locateCountry} from '../server/geo-country.mjs';

test('IP capture ignores untrusted forwarded headers and untrusted proxy peers',()=>{
  const req={headers:{'x-forwarded-for':'203.0.113.9','user-agent':'Browser\nInjected'},socket:{remoteAddress:'::ffff:127.0.0.1'}};
  assert.equal(clientMetadata(req,false).ip,'127.0.0.1');assert.equal(clientMetadata(req,true).ip,'203.0.113.9');assert.equal(clientMetadata({...req,socket:{remoteAddress:'8.8.8.8'}},true).ip,'8.8.8.8');assert.equal(clientMetadata(req,false).agent,'BrowserInjected');

});
test('customer directory scopes private metadata and money; session revocation preserves balances',async()=>{
  const root=resolve('work'),folder=await mkdtemp(join(root,'customer-test-')),store=createStore(':memory:');
  try{
    await initializeGeoCountry();
    assert.equal(locateCountry('8.8.8.8').country,'US');assert.equal(locateCountry('114.114.114.114').country,'CN');assert.equal(locateCountry('2001:4860:4860::8888').country,'US');assert.equal(locateCountry('::1').source,'private');
    const admin=createAdminAuth(store,4993),auth=createCreatorAuth(store,4993),finance=createFinance(store,folder),scope=createOperatorScope(store);
    admin.setup({username:'test-master',password:'Testing1234'});const agent=admin.createAgent('test-master',{username:'test-agent',password:'Testing1234'}),operator={id:agent.id,role:'agent',username:'test-agent'};
    const invite=auth.createInvite('test-agent',{},agent.id),other=auth.createInvite('test-master',{});
    const req={headers:{'user-agent':'QA Browser','x-forwarded-for':'203.0.113.5'},socket:{remoteAddress:'8.8.8.8'}};
    const first=await auth.register(req,{email:'owned@example.com',password:'Testing1234',inviteCode:invite.code,country:'GE'}),second=await auth.register(req,{email:'other@example.com',password:'Testing1234',inviteCode:other.code,country:'CN'});
    finance.adjust('test-agent',first.user.id,{amount:'25.30',direction:'credit',note:'Explicit test funding',operationKey:'customer-directory-test-funds'});
    auth.updateNote('test-agent',first.user.id,{note:'Internal follow-up only'});
    const rows=customerDirectory(store,auth,scope,operator);assert.equal(rows.length,1);const row=rows[0];assert.equal(row.country,'US');assert.equal(row.country_source,'ip');assert.equal(row.registration_ip,'8.8.8.8');assert.equal(row.agent_username,'test-agent');assert.equal(row.identity_status,'not_submitted');assert.equal(row.wallet.available,2630);assert.equal(row.wallet.total,2630);assert.equal(row.admin_note,'Internal follow-up only');assert.equal(row.session_count,1);
    assert.ok(!JSON.stringify(rows).includes('password_hash'));assert.ok(!JSON.stringify(rows).includes('other@example.com'));
    assert.throws(()=>scope.guard(operator,'/api/admin/accounts/'+second.user.id+'/notes','POST'),e=>e.status===403);
    assert.throws(()=>scope.guard(operator,'/api/admin/accounts/'+second.user.id+'/revoke-sessions','POST'),e=>e.status===403);
    scope.guard(operator,'/api/admin/accounts/'+first.user.id+'/notes','POST');
    const sessionReq={...req,headers:{cookie:auth.cookie(first.token).split(';')[0]}};assert.equal(auth.current(sessionReq).country,'US');assert.ok(!JSON.stringify(auth.current(sessionReq)).includes('Internal follow-up'));
    await auth.login({...req,socket:{remoteAddress:'114.114.114.114'}},{email:first.user.email,password:'Testing1234'});assert.equal(auth.current(sessionReq).country,'CN');
    auth.revokeSessions('test-agent',first.user.id);assert.equal(auth.current(sessionReq),null);assert.equal(customerDirectory(store,auth,scope,operator)[0].wallet.available,2630);
  }finally{store.close();if(!resolve(folder).startsWith(root+sep))throw new Error('Unsafe test cleanup');await rm(folder,{recursive:true,force:true});}
});
