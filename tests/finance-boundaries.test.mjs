import {createFundPassword} from '../server/fund-password.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createStore} from '../server/store.mjs';
import {createCreatorAuth} from '../server/creator-auth.mjs';
import {createFinance} from '../server/finance.mjs';

async function fixture(run){
 await mkdir(resolve('work'),{recursive:true});const dir=await mkdtemp(resolve('work/fund-boundaries-')),store=createStore(join(dir,'workspace.sqlite'));
 try{
  const auth=createCreatorAuth(store,4977),finance=createFinance(store,dir),invite=auth.createInvite('qa',{},'super');
  const user=(await auth.register({headers:{},socket:{remoteAddress:'127.0.0.1'}},{email:'boundaries@example.invalid',password:'BoundaryTest123!',inviteCode:invite.code})).user;
createFundPassword(store).save(user.id,{loginPassword:'BoundaryTest123!',newPassword:'Funds-Only-QA-2026!',confirmPassword:'Funds-Only-QA-2026!'});
  const photo=(await readFile('public/art/poster0.png')).toString('base64');
  const identity=finance.identity(user.id,{name:'边界测试',documentType:'护照',number:'BOUNDARY123',frontPhoto:{data:photo},backPhoto:{data:photo}});finance.review('qa','identity',identity.id,{decision:'approve'});
  for(const number of ['0000000000001111','0000000000002222']){finance.card(user.id,{provider:'okx',number});}
  finance.adjust('qa',user.id,{direction:'credit',amount:'199',note:'isolated fixture',operationKey:randomUUID()});
  await run({store,auth,finance,user,cards:finance.snapshot(user.id).cards,balance:()=>store.asUser(user.id,()=>store.summary().wallet.available)});
 }finally{store.close();await rm(dir,{recursive:true,force:true});}
}

test('a financial idempotency key cannot be reused with a different receipt or destination',()=>fixture(async({finance,user,cards,balance})=>{
 const deposit={kind:'deposit',amount:'20',reference:'channel-A-receipt-1',operationKey:randomUUID()},first=finance.apply(user.id,deposit);
 assert.equal(finance.apply(user.id,{...deposit}).id,first.id);
 assert.throws(()=>finance.apply(user.id,{...deposit,reference:'channel-B-receipt-2'}),e=>e.status===409);
 const withdrawal={kind:'withdrawal',fundPassword:'Funds-Only-QA-2026!',amount:'10',cardId:cards[0].id,operationKey:randomUUID()},held=finance.apply(user.id,withdrawal);
 assert.equal(finance.apply(user.id,{...withdrawal}).id,held.id);
 assert.throws(()=>finance.apply(user.id,{...withdrawal,cardId:cards[1].id}),e=>e.status===409);
 assert.equal(balance(),19000);
}));

test('financial notifications belong to the customer and retries do not duplicate them',()=>fixture(async({store,finance,user})=>{
 const notices=()=>store.asUser(user.id,()=>store.notifications({limit:100}));
 const before=notices().notifications.length,input={kind:'deposit',amount:'7.25',reference:'notification-receipt-unique',operationKey:randomUUID()},request=finance.apply(user.id,input);
 finance.apply(user.id,input);assert.equal(notices().notifications.length,before+1);
 finance.review('qa','fund',request.id,{decision:'approve',confirmReceived:true});
 assert.throws(()=>finance.review('qa','fund',request.id,{decision:'approve',confirmReceived:true}),e=>e.status===409);
 const current=notices().notifications;assert.equal(current.length,before+2);const related=current.filter(n=>n.record_id===request.id);assert.equal(related.length,2);assert.ok(related.every(n=>n.owner_id===user.id&&n.category==='finance'));assert.ok(related.some(n=>n.title==='充值已到账'));
 assert.equal(store.asUser('unrelated-customer',()=>store.notifications()).notifications.length,0);
 for(const invalid of ['x'.repeat(151),'','xx'])assert.throws(()=>finance.apply(user.id,{...input,reference:invalid,operationKey:randomUUID()}),e=>e.status===400);
 assert.throws(()=>finance.apply(user.id,{...input,operationKey:'a'.repeat(81)}),e=>e.status===400);
}));

test('the same external payout receipt cannot mark two withdrawals as paid',()=>fixture(async({store,finance,user,cards,balance})=>{
 const requests=Array.from({length:2},()=>finance.apply(user.id,{kind:'withdrawal',fundPassword:'Funds-Only-QA-2026!',amount:'10',cardId:cards[0].id,operationKey:randomUUID()}));
 for(const request of requests)finance.review('qa','fund',request.id,{decision:'approve'});
 finance.review('qa','fund',requests[0].id,{decision:'paid',reference:'bank-receipt-unique-1'});
 assert.throws(()=>finance.review('qa','fund',requests[1].id,{decision:'paid',reference:'bank-receipt-unique-1'}),e=>e.status===409);
 assert.equal(finance.snapshot(user.id).requests.find(r=>r.id===requests[1].id).status,'paying');
 assert.equal(balance(),18000);assert.equal(store.asUser(user.id,()=>store.summary()).wallet.withdrawalHeld,1000);
}));

test('frozen task owner cannot receive approval settlement through the administrator path',()=>fixture(async({store,finance,user,balance})=>{
 store.setCommissionRate('5');const task=store.createTask({stage:1,title:'冻结审核边界',description:'提交作品',platform:'TikTok',language:'中文',genre:'剧情',deposit:'50',posts:1,episodes:1,slots:10,cover:'/art/hero-v2.webp'}),as=fn=>store.asUser(user.id,fn);
 const assignment=as(()=>store.claim(task.id,{amount:task.deposit,commission:task.commission,rateBps:task.commission_rate_bps}));
 const upload=as(()=>store.addUpload(assignment.id,{name:'proof.png',mime:'image/png',size:24,path:'/uploads/aaaa1111-1111-1111-1111-111111111111.png'}));as(()=>store.submit(assignment.id,{links:['https://example.invalid/work'],uploadIds:[upload.id]}));
 finance.freeze('qa',user.id,{frozen:true,reason:'account review in progress'});
 assert.throws(()=>store.review(assignment.id,{decision:'approve'}),e=>e.status===403);
 assert.equal(store.assignment(assignment.id).status,'review');assert.equal(balance(),15000);assert.equal(store.db.prepare("SELECT COUNT(*) n FROM ledger WHERE operation_key=?").get('reward:'+assignment.id).n,0);
 finance.freeze('qa',user.id,{frozen:false,reason:'account review resolved'});store.review(assignment.id,{decision:'approve'});assert.equal(balance(),20250);
}));
