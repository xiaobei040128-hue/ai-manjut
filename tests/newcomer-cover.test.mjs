import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createStore} from '../server/store.mjs';
import {createAdminAuth} from '../server/auth.mjs';
import {createCreatorAuth} from '../server/creator-auth.mjs';
import {createFinance} from '../server/finance.mjs';
import {createStageJourney} from '../server/stage-journey.mjs';
import {createStageDispatch} from '../server/stage-dispatch.mjs';
import {createOperatorScope} from '../server/operators.mjs';
import {customerDirectory} from '../server/customer-directory.mjs';
test('newcomer cover costs exactly 188 cents, binds a persistent code, and settles once after code verification',async()=>{
 await mkdir(resolve('work'),{recursive:true});const dir=await mkdtemp(resolve('work/cover-test-')),s=createStore(join(dir,'workspace.sqlite'));
 try{
  createAdminAuth(s,4990);
  const auth=createCreatorAuth(s,4990),finance=createFinance(s,dir),dispatch=createStageDispatch(s),journey=createStageJourney(s),invite=auth.createInvite('qa',{},'super');
  const image=(await readFile('public/art/poster0.png')).toString('base64');
  async function register(email){const user=(await auth.register({headers:{},socket:{remoteAddress:'qa'}},{email,password:'CoverTestQA123!',inviteCode:invite.code})).user;const identity=finance.identity(user.id,{name:'测试用户',documentType:'驾驶证',number:'TEST-COVER-'+user.id.slice(0,8),frontPhoto:{data:image},backPhoto:{data:image}});finance.review('qa','identity',identity.id,{decision:'approve'});return user;}
  const a=await register('cover-a@example.invalid'),b=await register('cover-b@example.invalid');journey.sync(a.id);
  s.setCommissionRate('5');const source=s.createTask({title:'封面作品',description:'本次作品的剧情概览',platform:'TikTok',language:'中文',genre:'剧情',deposit:'999',posts:1,episodes:12,slots:10,cover:'/art/hero-v2.webp',stage:1});
  const as=fn=>s.asUser(a.id,fn);assert.equal(as(()=>s.summary()).wallet.available,200);assert.equal(journey.snapshot(a.id).cover,null);
  const oldOffer=dispatch.draw(a.id,1);const received=journey.take(a.id);assert.equal(received.cover.amount,188);assert.equal(received.cover.artwork.episodes,12);assert.equal(received.cover.code,null);assert.equal(dispatch.pending(a.id),null);assert.equal(s.db.prepare('SELECT retired FROM stage_task_offers WHERE id=?').get(oldOffer.id).retired,1);assert.equal(s.getTask(source.id).deposit,99900);assert.throws(()=>dispatch.draw(a.id,1),e=>e.status===409);assert.throws(()=>dispatch.accept(a.id,oldOffer.id,{amount:99900,commission:4995,rateBps:500}),e=>e.status===409);
  const quote=received.cover,input={orderId:quote.id,expected:{amount:188,commission:9,rateBps:500}};
  assert.throws(()=>journey.purchaseCover(a.id,{...input,expected:{...input.expected,amount:1}}),e=>e.status===409);
  assert.throws(()=>journey.purchaseCover(b.id,input),e=>e.status===404);
  const poor=journey.take(b.id).cover;assert.throws(()=>journey.purchaseCover(b.id,{orderId:poor.id,expected:input.expected}),e=>e.status===409);assert.equal(journey.snapshot(b.id).cover.code,null);
  const purchased=journey.purchaseCover(a.id,input).cover;assert.match(purchased.code,/^COV-[A-F0-9]{18}$/);assert.equal(as(()=>s.summary()).wallet.available,12);assert.equal(as(()=>s.summary()).wallet.held,188);
  const directory=customerDirectory(s,auth,createOperatorScope(s),{role:'super',id:'super',username:'qa'}).find(u=>u.id===a.id);assert.equal(directory.wallet.held,188);assert.equal(directory.wallet.total,200);
  assert.equal(journey.purchaseCover(a.id,input).cover.code,purchased.code);assert.equal(createStageJourney(s).snapshot(a.id).cover.code,purchased.code);s.setCommissionRate('10');assert.equal(journey.snapshot(a.id).cover.commission,9);
  assert.throws(()=>journey.submitCover(a.id,{orderId:quote.id,code:'WRONG'}),e=>e.status===400);assert.throws(()=>journey.submitCover(b.id,{orderId:quote.id,code:purchased.code}),e=>e.status===404);assert.equal(as(()=>s.summary()).wallet.held,188);
  const submit={orderId:quote.id,code:purchased.code};assert.equal(journey.submitCover(a.id,submit).settlement.first,true);assert.equal(journey.submitCover(a.id,submit).settlement.first,false);
  const done=journey.snapshot(a.id);assert.equal(done.newcomer.experience,true);assert.equal(done.onboarding.step,3);assert.equal(done.onboarding.revealed,false);assert.equal(as(()=>s.summary()).wallet.available,209);assert.equal(as(()=>s.summary()).wallet.held,0);assert.equal(as(()=>s.summary()).wallet.earned,9);
  for(const kind of ['cover-hold:','cover-release:','cover-reward:'])assert.equal(s.db.prepare('SELECT COUNT(*) n FROM ledger WHERE operation_key=?').get(kind+quote.id).n,1);
 }finally{s.close();}
});
