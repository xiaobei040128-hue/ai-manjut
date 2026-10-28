import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const base='http://127.0.0.1:4192';
test('all 14 agent permission switches enforce live sessions, ownership, and customer state sync',async t=>{
 const dir=await mkdtemp(resolve('work/agent-permissions-'));const child=spawn(process.execPath,['server/index.mjs','--production','--port','4192'],{env:{...process.env,DRAMA_DATA_DIR:dir},windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
 async function call(token,path,input,method=input===undefined?'GET':'POST'){return fetch(base+'/api'+path,{method,headers:{Cookie:token,'Content-Type':'application/json','X-Workspace-Request':'1'},body:input===undefined?undefined:JSON.stringify(input)});}
 async function json(token,path,input,method){const r=await call(token,path,input,method),b=await r.json();assert.ok(r.ok,path+': '+JSON.stringify(b));return b;}
 try{
 for(let i=0;i<200&&!output.includes('Drama Studio 2.0:');i++){if(child.exitCode!==null)throw Error(output);await new Promise(r=>setTimeout(r,25));}assert.ok(output.includes('Drama Studio 2.0:'),output);
 const setup=await call('','/admin/setup',{username:'permission-master',password:'Permissions2026!'});assert.equal(setup.status,200);const master=setup.headers.get('set-cookie').split(';')[0];
 const agent=await json(master,'/admin/agents',{username:'permission-agent',password:'Permissions2026!'}),other=await json(master,'/admin/agents',{username:'permission-other',password:'Permissions2026!'});
 const login=async username=>{const r=await call('','/admin/login',{username,password:'Permissions2026!'});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 const token=await login('permission-agent'),otherToken=await login('permission-other');const invite=await json(token,'/admin/invitations',{count:1}),otherInvite=await json(otherToken,'/admin/invitations',{count:1});
 async function register(email,code){const r=await call('','/auth/register',{email,password:'Customer2026!',inviteCode:code});assert.equal(r.status,201);return {id:(await r.json()).user.id,token:r.headers.get('set-cookie').split(';')[0]};}
 const a=await register('permission-a@audit.invalid',invite.code),b=await register('permission-b@audit.invalid',otherInvite.code);const path='/admin/agents/'+agent.id+'/permissions';let config=await json(master,path);
 assert.equal(Object.keys(config.permissions).length,16);for(const tok of [token,otherToken,a.token]){assert.equal((await call(tok,path)).status,tok===a.token?401:403);assert.equal((await call(tok,path,config)).status,tok===a.token?401:403);}
 assert.equal((await call(master,path,{...config,permissions:{...config.permissions,unknown:true}})).status,400);
 const tested=[];
 async function exercise(key,route,input,verify,method){await t.test(key+' off → on → customer sync',async()=>{
  config=await json(master,path,{revision:config.revision,permissions:{...config.permissions,[key]:false}});
  const before=await json(a.token,'/finance');assert.equal((await json(token,'/admin/session')).permissions[key],false);assert.equal((await json(token,'/admin/bootstrap')).admin.permissions[key],false);
  assert.equal((await call(token,route,input,method)).status,403);assert.deepEqual(await json(a.token,'/finance'),before);
  const stale={...config};config=await json(master,path,{revision:config.revision,permissions:{...config.permissions,[key]:true}});assert.equal((await call(master,path,stale)).status,409);
  const r=await call(token,route,input,method);assert.ok(r.ok,route+': '+await r.clone().text());if(verify)await verify(r);assert.equal((await json(b.token,'/finance')).account.available,100);tested.push(key);
 });}
 await exercise('invitations','/admin/invitations',{count:1},async r=>assert.ok((await r.json()).code));
 await exercise('customerEdit','/admin/accounts/'+a.id+'/notes',{note:'permission sync QA'},async()=>assert.equal((await json(token,'/admin/customers/'+a.id)).customer.admin_note,'permission sync QA'));
 await exercise('customerSecurity','/admin/accounts/'+a.id+'/fund-password',{newPassword:'FundsOnly2026!',confirmPassword:'FundsOnly2026!',confirmed:true},async()=>assert.equal((await json(a.token,'/auth/fund-password')).configured,true));
 const photo=(await readFile('public/art/poster0.png')).toString('base64');const identity=await json(a.token,'/finance/identity',{name:'权限测试',documentType:'护照',number:'QA-IDENTITY-2026',frontPhoto:{data:photo},backPhoto:{data:photo}});
 await exercise('identityReview','/admin/finance/identity/'+identity.id+'/review',{decision:'approve'},async()=>assert.equal((await json(a.token,'/finance')).identity.status,'approved'));
 await exercise('sensitiveReveal','/admin/finance/identity/'+identity.id+'/reveal',{},async r=>assert.equal((await r.json()).number,'QA-IDENTITY-2026'));
 await exercise('balanceAdjust','/admin/finance/account/'+a.id+'/adjust',{amount:'20',direction:'credit',note:'QA permission funding',operationKey:randomUUID()},async()=>assert.equal((await json(a.token,'/finance')).account.available,2100));
 await json(a.token,'/finance/cards',{provider:'bank',bank:'QA银行',holder:'权限测试',number:'0000000000001111'});const card=(await json(a.token,'/finance')).cards[0];
 await exercise('payoutReview','/admin/finance/bank/'+card.id+'/review',{decision:'approve'},async()=>assert.equal((await json(a.token,'/finance')).cards[0].status,'approved'));
 const deposit=await json(a.token,'/finance/requests',{kind:'deposit',amount:'10',reference:randomUUID(),operationKey:randomUUID()});
 await exercise('depositReview','/admin/finance/fund/'+deposit.id+'/review',{decision:'approve',confirmReceived:true},async()=>assert.equal((await json(a.token,'/finance')).account.available,3100));
 await json(a.token,'/finance/cards',{provider:'okx',number:'12345678'});const payout=(await json(a.token,'/finance')).cards.find(c=>c.provider==='okx');
 const withdrawal=await json(a.token,'/finance/requests',{kind:'withdrawal',amount:'1',fundPassword:'FundsOnly2026!',cardId:payout.id,operationKey:randomUUID()});
 await exercise('withdrawalReview','/admin/finance/fund/'+withdrawal.id+'/review',{decision:'approve'},async()=>assert.equal((await json(a.token,'/finance')).requests.find(r=>r.id===withdrawal.id).status,'paying'));
 config=await json(master,path,{revision:config.revision,permissions:{...config.permissions,withdrawalReview:false}});assert.equal((await call(token,'/admin/finance/fund/'+withdrawal.id+'/review',{decision:'paid',reference:randomUUID()})).status,403);config=await json(master,path,{revision:config.revision,permissions:{...config.permissions,withdrawalReview:true}});await json(token,'/admin/finance/fund/'+withdrawal.id+'/review',{decision:'paid',reference:randomUUID()});assert.equal((await json(a.token,'/finance')).requests.find(r=>r.id===withdrawal.id).status,'paid');
 await exercise('taskConfigure','/admin/plan-dispatch/'+a.id,{planDay:1,revision:0,standard:{amount:'200',rate:'3.5'},slots:{},randomPricing:{minAmount:'200.11',maxAmount:'750.99'}},async()=>assert.deepEqual((await json(token,'/admin/plan-dispatch/'+a.id)).plans[0].configuration.randomPricing,{minAmount:20011,maxAmount:75099}));
 // Synthetic pending enrollment: rejection verifies status propagation without claiming a completed journey.
 const db=new DatabaseSync(join(dir,'workspace.sqlite'));const enrollment=randomUUID();db.prepare('INSERT INTO stage_enrollments(id,user_id,created_at) VALUES(?,?,?)').run(enrollment,a.id,new Date().toISOString());db.close();
 await exercise('enrollmentReview','/admin/stage-enrollments/'+enrollment+'/review',{decision:'reject',note:'QA同步验收'},async()=>assert.equal((await json(a.token,'/stage-three/enrollment')).enrollment.status,'rejected'));
 const campaign=await json(master,'/admin/activity-rewards',{name:'权限验收奖励',amount:'1',budget:'10',operatorId:agent.id});const balance=(await json(a.token,'/finance')).account.available;
 await exercise('rewardGrant','/admin/activity-rewards/'+campaign.id+'/grant',{userId:a.id,reason:'QA同步验收',operationKey:randomUUID(),confirm:true},async()=>assert.equal((await json(a.token,'/finance')).account.available,balance+100));
 await exercise('ledgerExport','/export/ledger?scope=all',undefined,async r=>assert.ok((await r.text()).includes('QA')));
 await exercise('accountFreeze','/admin/finance/account/'+a.id+'/freeze',{frozen:true,reason:'QA权限同步'},async()=>assert.equal((await call(a.token,'/finance')).status,401));
 await json(token,'/admin/finance/account/'+a.id+'/freeze',{frozen:false,reason:'QA恢复账户'});
 for(const route of ['/admin/customers/'+b.id,'/admin/plan-dispatch/'+b.id])assert.equal((await call(token,route)).status,403);
 assert.equal((await call(token,'/admin/finance/account/'+b.id+'/adjust',{amount:'1',direction:'credit',note:'QA越权',operationKey:randomUUID()})).status,403);
 assert.equal(tested.length,14);assert.equal((await json(b.token,'/finance')).account.available,100);
 }finally{child.kill();await new Promise(r=>child.once('exit',r));await rm(dir,{recursive:true,force:true});}
});
