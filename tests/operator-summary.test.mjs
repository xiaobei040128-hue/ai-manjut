import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createStore} from '../server/store.mjs';
import {createAdminAuth} from '../server/auth.mjs';
import {createCreatorAuth} from '../server/creator-auth.mjs';
import {createFinance} from '../server/finance.mjs';
import {createOperatorScope} from '../server/operators.mjs';

test('operator aggregate contains only owned money and evidence, without legacy private state',async()=>{
 await mkdir(resolve('work'),{recursive:true});const dir=await mkdtemp(resolve('work/operator-summary-')),s=createStore(join(dir,'workspace.sqlite'));
 try{
  const admin=createAdminAuth(s,4966);admin.setup({username:'summary-admin',password:'SummaryQA123!'});const auth=createCreatorAuth(s,4966),finance=createFinance(s,dir),scope=createOperatorScope(s);
  const agents=['a','b'].map(suffix=>({...admin.createAgent('summary-admin',{username:'summary-agent-'+suffix,password:'SummaryQA123!'}),role:'agent'})),users=[];
  for(const agent of agents){const invite=auth.createInvite(agent.username,{},agent.id);const user=(await auth.register({headers:{},socket:{remoteAddress:'127.0.0.1'}},{email:agent.username+'@example.invalid',password:'SummaryQA123!',inviteCode:invite.code})).user;users.push(user);finance.adjust('summary-admin',user.id,{direction:'credit',amount:agent===agents[0]?'199':'399',note:'Isolated operator fixture',operationKey:'summary-funding-'+user.id});}
  for(const user of users)finance.apply(user.id,{kind:'deposit',amount:'1',reference:'scope-receipt-'+user.id,operationKey:'scope-operation-'+user.id});
  const financeA=finance.admin([users[0].id]);assert.equal(financeA.users.length,1);assert.equal(financeA.requests.length,1);assert.equal(financeA.requests[0].user_id,users[0].id);assert.ok(!JSON.stringify(financeA).includes(users[1].email));
  assert.deepEqual(finance.admin([]),{users:[],identities:[],cards:[],requests:[]});assert.equal(finance.admin().users.length,2);assert.throws(()=>finance.admin('bad'),e=>e.status===400);
  s.setCommissionRate('5');const task=s.createTask({stage:1,title:'归属汇总测试',description:'发布作品',platform:'TikTok',language:'中文',genre:'剧情',deposit:50,posts:1,episodes:1,slots:20,cover:'/art/hero-v2.webp'}),quote={amount:task.deposit,commission:task.commission,rateBps:task.commission_rate_bps};
  const claims=users.map(user=>s.asUser(user.id,()=>s.claim(task.id,quote)));
  for(let n=0;n<users.length;n++)s.asUser(users[n].id,()=>{s.addUpload(claims[n].id,{name:'owner-'+n+'.png',mime:'image/png',size:100,path:'/uploads/owner-'+n+'.png'});s.saveDraft(claims[n].id,{note:'private-note-'+n});});
  s.bookmark(task.id);s.notifyUser('legacy','Legacy private message','must not appear to agents');
  const first=scope.summary(agents[0]),second=scope.summary(agents[1]);
  assert.equal(first.wallet.available,15000);assert.equal(second.wallet.available,35000);assert.equal(first.wallet.held,5000);assert.equal(second.wallet.held,5000);assert.equal(first.assignments.length,1);assert.equal(second.assignments.length,1);assert.equal(first.assignments[0].uploads[0].name,'owner-0.png');assert.equal(second.assignments[0].uploads[0].name,'owner-1.png');
  assert.ok(!JSON.stringify(first).includes('private-note-1'));assert.ok(!JSON.stringify(first).includes('owner-1.png'));assert.ok(!JSON.stringify(first).includes('Legacy private message'));assert.equal(first.notificationsUnread,0);assert.equal(first.bookmarks.length,0);assert.equal(first.savedTasks.length,0);
  const selected=s.summary({owners:[users[0].id]});assert.equal(selected.assignments.length,1);assert.equal(selected.wallet.available,15000);assert.equal(selected.notifications.length,0);assert.equal(selected.profile,null);
  const empty=s.summary({owners:[]});assert.equal(empty.assignments.length,0);assert.equal(empty.ledger.length,0);assert.equal(empty.wallet.available,0);
  const creator=s.asUser(users[0].id,()=>s.summary({owners:[users[1].id]}));assert.equal(creator.assignments[0].owner_id,users[0].id);assert.equal(creator.wallet.available,15000);
 }finally{s.close();await rm(dir,{recursive:true,force:true});}
});
