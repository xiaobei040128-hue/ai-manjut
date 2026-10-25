import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createStore} from '../server/store.mjs';
import {createCreatorAuth} from '../server/creator-auth.mjs';
import {createStageJourney} from '../server/stage-journey.mjs';
import {createFinance} from '../server/finance.mjs';
test('crypto destinations validate provider and network, encrypt details and are usable immediately',async()=>{
 await mkdir(resolve('work'),{recursive:true});const dir=await mkdtemp(resolve('work/payout-test-')),s=createStore(join(dir,'workspace.sqlite'));
 try{const auth=createCreatorAuth(s,4990),f=createFinance(s,dir),invite=auth.createInvite('qa',{},'super'),user=(await auth.register({headers:{},socket:{remoteAddress:'qa'}},{email:'payout@example.invalid',password:'PayoutTestQA123!',inviteCode:invite.code})).user;
 const image=(await readFile('public/art/poster0.png')).toString('base64');const identity=f.identity(user.id,{name:'测试用户',documentType:'驾驶证',number:'PAYOUT-TEST-001',frontPhoto:{data:image},backPhoto:{data:image}});f.review('qa','identity',identity.id,{decision:'approve'});
 for(const input of [{provider:'binance',number:'12345678'},{provider:'okx',number:'12345678'},{provider:'usdt',network:'TRC20',number:'T'+'A'.repeat(33)},{provider:'usdt',network:'ERC20',number:'0x'+'a'.repeat(40)}]){const previous=f.snapshot(user.id).cards.length;assert.equal(f.card(user.id,input).firstBinding,previous===0);}
 const journey=createStageJourney(s);assert.equal(journey.bindingCompletion(user.id).show,true);assert.equal(journey.bindingCompletion(user.id).show,false);
 const cards=f.snapshot(user.id).cards;assert.equal(cards.length,4);assert.ok(cards.every(c=>c.status==='approved'));assert.ok(!JSON.stringify(cards).includes('0x'+'a'.repeat(40)));assert.ok(cards.every(c=>!('number_cipher' in c)));
 assert.throws(()=>f.card(user.id,{provider:'usdt',network:'TRC20',number:'0x'+'a'.repeat(40)}));assert.throws(()=>f.card(user.id,{provider:'usdt',network:'OTHER',number:'T'+'A'.repeat(33)}));assert.throws(()=>f.card(user.id,{provider:'binance',number:'abc'}));assert.throws(()=>f.card(user.id,{provider:'binance',number:'12345678'}));
 const c=cards.find(c=>c.provider==='usdt'&&c.network==='ERC20');assert.equal(f.reveal('qa','bank',c.id).number,'0x'+'a'.repeat(40));assert.equal(f.reveal('qa','bank',c.id).network,'ERC20');const request=f.apply(user.id,{kind:'withdrawal',amount:'1',cardId:c.id,operationKey:'payout-test-withdrawal-001'});assert.equal(request.status,'review');assert.equal(f.snapshot(user.id).cards.find(x=>x.id===c.id).network,'ERC20');
 }finally{s.close();}
});
