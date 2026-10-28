import {createFundPassword} from '../server/fund-password.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createStore} from './fixtures/store.mjs';
import {createCreatorAuth} from '../server/creator-auth.mjs';
import {createFinance} from '../server/finance.mjs';
import {randomUUID} from 'node:crypto';
test('manual finance approvals, holds, refunds, encryption and account freeze are consistent',async()=>{
 const dir=await mkdtemp(resolve('work/finance-unit-')),s=createStore(join(dir,'workspace.sqlite')),auth=createCreatorAuth(s,4913),f=createFinance(s,dir),req={headers:{},socket:{remoteAddress:'qa'}},invite=auth.createInvite('admin',{}),password='Finance-QA-Password-2026!',photo=(await readFile('public/art/poster0.png')).toString('base64');
 try{const result=await auth.register(req,{email:'finance@example.com',password,inviteCode:invite.code}),id=result.user.id;createFundPassword(s).save(id,{loginPassword:password,newPassword:'Funds-Only-QA-2026!',confirmPassword:'Funds-Only-QA-2026!'});
req.headers.cookie=auth.cookie(result.token).split(';')[0];assert.equal(s.asUser(id,()=>s.summary()).wallet.available,100);f.adjust('admin',id,{amount:'1999',direction:'credit',note:'Explicit QA funding',operationKey:randomUUID()});const balance=()=>s.asUser(id,()=>s.summary().wallet.available),apply=amount=>f.apply(id,{kind:'withdrawal',fundPassword:'Funds-Only-QA-2026!',amount,cardId:(f.snapshot(id).cards.find(c=>c.provider==='okx')||f.snapshot(id).cards[0])?.id,operationKey:randomUUID()});
  assert.throws(()=>apply('10'),e=>e.status===409);assert.throws(()=>f.apply(id,{kind:'deposit',amount:'1.001',reference:'qa-ref',operationKey:randomUUID()}));
  const identity=f.identity(id,{name:'测试用户',documentType:'居民身份证',number:'11000020000101000X',frontPhoto:{data:photo},backPhoto:{data:photo}});assert.equal(identity.status,'review');assert.throws(()=>f.identity(id,{name:'测试用户',documentType:'护照',number:'TEST0000'}),e=>e.status===409);
  assert.ok(!JSON.stringify(f.admin()).includes('11000020000101000X'));const encrypted=s.db.prepare('SELECT number_cipher FROM identities WHERE id=?').get(identity.id).number_cipher;assert.ok(!encrypted.includes('11000020000101000X'));assert.equal(f.reveal('admin','identity',identity.id).number,'11000020000101000X');
  f.review('admin','identity',identity.id,{decision:'approve'});assert.throws(()=>f.card(id,{bank:'验收银行',holder:'其他人',number:'0000000000001234'}));f.card(id,{bank:'验收银行',holder:'测试用户',number:'0000000000001234'});let card=f.snapshot(id).cards[0];assert.equal(card.status,'review');assert.throws(()=>apply('10'),e=>e.status===409);f.review('admin','bank',card.id,{decision:'approve'});f.card(id,{provider:'okx',number:'12345678'});const payout=f.snapshot(id).cards.find(c=>c.provider==='okx');
  const deposit=f.apply(id,{kind:'deposit',amount:'50.25',reference:'QA-transfer-1',operationKey:randomUUID()});assert.equal(balance(),200000);assert.throws(()=>f.review('admin','fund',deposit.id,{decision:'approve'}));f.review('admin','fund',deposit.id,{decision:'approve',confirmReceived:true});assert.equal(balance(),205025);assert.throws(()=>f.review('admin','fund',deposit.id,{decision:'approve',confirmReceived:true}));assert.equal(balance(),205025);
  const key=randomUUID(),withdraw=f.apply(id,{kind:'withdrawal',fundPassword:'Funds-Only-QA-2026!',amount:'10.25',cardId:payout.id,operationKey:key});assert.equal(balance(),204000);assert.equal(f.apply(id,{kind:'withdrawal',fundPassword:'Funds-Only-QA-2026!',amount:'10.25',cardId:payout.id,operationKey:key}).id,withdraw.id);assert.equal(balance(),204000);assert.equal(s.asUser(id,()=>s.summary()).wallet.withdrawalHeld,1025);
  f.freeze('admin',id,{frozen:true,reason:'验收冻结账户'});assert.equal(auth.current(req),null);await assert.rejects(auth.login({headers:{},socket:{remoteAddress:'login'}},{email:'finance@example.com',password}),e=>e.status===403);assert.throws(()=>f.review('admin','fund',withdraw.id,{decision:'approve'}),e=>e.status===403);assert.throws(()=>apply('10'),e=>e.status===403);
  f.freeze('admin',id,{frozen:false,reason:'验收解冻账户'});f.review('admin','fund',withdraw.id,{decision:'approve'});assert.equal(f.snapshot(id).requests.find(r=>r.id===withdraw.id).status,'paying');assert.equal(balance(),204000);assert.throws(()=>f.review('admin','fund',withdraw.id,{decision:'paid',reference:''}));f.review('admin','fund',withdraw.id,{decision:'paid',reference:'QA-external-paid-1'});assert.equal(balance(),204000);assert.equal(s.asUser(id,()=>s.summary()).wallet.withdrawalHeld,0);assert.throws(()=>f.review('admin','fund',withdraw.id,{decision:'paid',reference:'QA-external-paid-1'}));
  const rejected=apply('20');f.review('admin','fund',rejected.id,{decision:'reject',note:'验收拒绝提现'});assert.equal(balance(),204000);assert.throws(()=>f.review('admin','fund',rejected.id,{decision:'reject',note:'再次拒绝'}));
  const adjustment={amount:'5.50',direction:'credit',note:'验收上分',operationKey:randomUUID()};f.adjust('admin',id,adjustment);f.adjust('admin',id,adjustment);assert.equal(balance(),204550);assert.throws(()=>f.adjust('admin',id,{amount:'99999',direction:'debit',note:'余额不足测试',operationKey:randomUUID()}));assert.equal(balance(),204550);
  let n=0;for(const r of s.db.prepare('SELECT * FROM ledger WHERE owner_id=? ORDER BY id').all(id)){n+=r.amount;assert.equal(r.balance_after,n);}assert.ok(!JSON.stringify(s.auditLog()).includes('11000020000101000X'));assert.equal((await readFile(join(dir,'finance.key'))).length,32);
 }finally{s.close();await rm(dir,{recursive:true,force:true});}
});

test('international identity numbers preserve original characters and await manual approval',async()=>{
 const dir=await mkdtemp(resolve('work/identity-international-')),s=createStore(join(dir,'workspace.sqlite')),auth=createCreatorAuth(s,4914),f=createFinance(s,dir),photo={data:(await readFile('public/art/poster0.png')).toString('base64')},invite=auth.createInvite('admin',{maxUses:20});
 try{
  for(const [n,number] of ['ab/12.٣-XY','1','เลขที่ ๑๒๓','é-456/abc'].entries()){
   const {user}=await auth.register({headers:{},socket:{remoteAddress:'international-'+n}},{email:`international-${n}@example.invalid`,password:'InternationalQA123!',inviteCode:invite.code});
   const input={name:'A',documentType:n%2?'护照':'居民身份证',number,frontPhoto:photo,backPhoto:photo};
   assert.throws(()=>f.identity(user.id,{...input,number:'   '}));
   assert.throws(()=>f.identity(user.id,{...input,number:'A'.repeat(151)}));
   const identity=f.identity(user.id,input);assert.equal(identity.status,'review');assert.equal(f.reveal('admin','identity',identity.id).number,number);
   assert.equal(s.db.prepare('SELECT number_cipher FROM identities WHERE id=?').get(identity.id).number_cipher.split('.').length,3);
  }
 }finally{s.close();await rm(dir,{recursive:true,force:true});}
});
