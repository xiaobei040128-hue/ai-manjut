import test from 'node:test';
import {syncStoryTasks} from '../server/sync-story-tasks.mjs';
import {createStore as fixtureStore} from './fixtures/store.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {restoreBackup} from '../scripts/restore-backup.mjs';
const base='http://127.0.0.1:4181',work=resolve('work');
let child,folder,cookie="",creatorId="";
async function start(){child=spawn(process.execPath,['server/index.mjs','--production','--port','4181','--host','127.0.0.1'],{cwd:process.cwd(),env:{...process.env,DRAMA_DATA_DIR:folder},stdio:['ignore','pipe','pipe'],windowsHide:true});let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);const begun=Date.now();while(!output.includes('Drama Studio 2.0:')){if(child.exitCode!==null)throw new Error(output);if(Date.now()-begun>15000)throw new Error('Server startup timed out: '+output);await new Promise(r=>setTimeout(r,25));}}
async function stop(){if(child&&child.exitCode===null){child.kill();await once(child,'exit');}}
async function request(path,method='GET',input,headers={}){if(path==='/assignments'&&method==='POST'&&typeof input?.taskId==='string'&&!input.expected){const q=await fetch(base+'/api/tasks/'+input.taskId,{headers:{Cookie:cookie}}).then(r=>r.json());input={...input,expected:{amount:q.deposit,commission:q.commission,rateBps:q.commission_rate_bps}};}return fetch(base+'/api'+path,{method,headers:{Cookie:cookie,...(method==='GET'?{}:{'Content-Type':'application/json','X-Workspace-Request':'1'}),...headers},body:input===undefined?undefined:JSON.stringify(input)});}
async function json(path,method,input){const r=await request(path,method,input);const b=await r.json();assert.ok(r.ok,JSON.stringify(b));return b;}
test('HTTP API validates boundaries and persists the complete workflow',async t=>{await mkdir(work,{recursive:true});folder=await mkdtemp(join(work,'api-check-'));try{const fixture=fixtureStore(join(folder,'workspace.sqlite'));syncStoryTasks(fixture);fixture.db.prepare("UPDATE tasks SET active=0 WHERE id!='secret-wife'").run();fixture.close();await start();let a;const screenshot=await readFile('public/art/poster0.png'),uploads=[];
 await t.test('health and initial balance',async()=>{assert.equal((await request('/bootstrap')).status,401);assert.equal((await json('/health')).ok,true);});
 await t.test('admin setup, cookie sessions and privileged API protection',async()=>{
  assert.equal((await json('/admin/session')).configured,false);
  for(const path of ['/admin/bootstrap','/manage/tasks','/export/backup'])assert.equal((await request(path)).status,401);
  assert.equal((await request('/tasks','POST',{})).status,401);assert.equal((await request('/materials/missing','DELETE')).status,401);assert.equal((await request('/assignments/missing/review','POST',{decision:'approve'})).status,401);
  assert.equal((await request('/admin/setup','POST',{username:'test-admin',password:'short'})).status,400);
  const r=await request('/admin/setup','POST',{username:'test-admin',password:'Local-Test-Password-2026!'});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.match(r.headers.get('set-cookie'),/SameSite=Strict/);cookie=r.headers.get('set-cookie').split(';')[0];assert.equal((await json('/admin/session')).authenticated,true);
  assert.equal((await request('/admin/setup','POST',{username:'other-admin',password:'Local-Test-Password-2026!'})).status,409);
  assert.equal((await request('/admin/login','POST',{username:'test-admin',password:'wrong-password'})).status,401);
  await json('/admin/commission-policy','POST',{rate:'15'});const snapshot=await json('/admin/bootstrap');assert.equal(snapshot.admin.username,'test-admin');assert.ok(snapshot.audit.some(a=>a.action==='auth.setup'));assert.ok(!JSON.stringify(snapshot).includes('password_hash'));
  const html=await fetch(base+'/admin');assert.equal(html.status,200);assert.match(await html.text(),/admin-root/);
  const channels=await json('/admin/deposit-channels');assert.equal(channels.channels.length,9);const updated=await json('/admin/deposit-channels','POST',{...channels,channels:channels.channels.map(c=>({...c,account:c.enabled?'API-QA-'+c.id:''}))});assert.equal(updated.revision,1);assert.equal((await request('/admin/deposit-channels','POST',channels)).status,409);
  const invite=await json('/admin/invitations','POST',{maxUses:2,days:1});const registered=await request('/auth/register','POST',{email:'acceptance@example.com',password:'Creator-Test-Password!',inviteCode:invite.code});assert.equal(registered.status,201);creatorId=(await registered.json()).user.id;cookie+='; '+registered.headers.get('set-cookie').split(';')[0];assert.equal((await json('/bootstrap')).wallet.available,100);await json('/admin/finance/account/'+creatorId+'/adjust','POST',{amount:'1999',direction:'credit',note:'Explicit API test funding',operationKey:'api-fixture-funding-2026'});assert.equal((await json('/bootstrap')).wallet.available,200000);
 });
 await t.test('stale creator document cannot read or mutate the replacement account',async()=>{
  const before=await json('/finance');
  for(const path of ['/bootstrap','/finance','/auth/session','/stage-finance'])assert.equal((await request(path,'GET',undefined,{'X-Creator-Account':'different-account'})).status,401);
  const attempted={kind:'deposit',amount:'1.23',reference:'stale-document-reference',operationKey:'stale-document-operation'};
  assert.equal((await request('/finance/requests','POST',attempted,{'X-Creator-Account':'different-account'})).status,401);
  assert.deepEqual(await json('/finance'),before);
  assert.equal((await request('/finance','GET',undefined,{'X-Creator-Account':creatorId})).status,200);
  assert.equal((await request('/admin/bootstrap','GET',undefined,{'X-Creator-Account':'different-account'})).status,200);
 });
 await t.test('production shell is compressed, cacheable and installable',async()=>{
  const r=await fetch(base+'/?view=app',{headers:{'Accept-Encoding':'br'}});assert.equal(r.status,200);assert.equal(r.headers.get('content-encoding'),'br');assert.equal(r.headers.get('cache-control'),'no-cache');const html=await r.text();assert.match(html,/<html lang="zh-CN">/);const script=html.match(/src="([^" ]+\.js)"/)[1];const js=await fetch(base+script,{headers:{'Accept-Encoding':'gzip'}});assert.equal(js.headers.get('content-encoding'),'gzip');assert.match(js.headers.get('cache-control'),/immutable/);const tag=js.headers.get('etag');assert.equal((await fetch(base+script,{headers:{'Accept-Encoding':'gzip','If-None-Match':tag}})).status,304);
  assert.equal((await fetch(base+'/assets/missing.js')).status,404);assert.equal((await fetch(base+'/sw.js')).headers.get('cache-control'),'no-cache');assert.match((await fetch(base+'/manifest.webmanifest')).headers.get('content-type'),/application\/manifest\+json/);
 });
 await t.test('cross-origin and missing request token rejected',async()=>{assert.equal((await request('/assignments','POST',{taskId:'secret-wife'},{Origin:'https://attacker.invalid'})).status,403);assert.equal((await request('/assignments','POST',{taskId:'secret-wife'},{'X-Workspace-Request':'0'})).status,403);});
 await t.test('malformed JSON shapes rejected as client errors',async()=>{assert.equal((await request('/profile','PATCH',null)).status,400);assert.equal((await request('/profile','PATCH',[])).status,400);assert.equal((await request('/assignments','POST',{})).status,400);});
 await t.test('claim and duplicate request create one hold',async()=>{const identity=await json('/finance/identity','POST',{name:'测试用户',documentType:'居民身份证',number:'11000020000101000X',frontPhoto:{data:screenshot.toString('base64')},backPhoto:{data:screenshot.toString('base64')}});await json('/admin/finance/identity/'+identity.id+'/review','POST',{decision:'approve'});assert.equal((await request('/stage-finance/draw','POST',{stage:2})).status,403);assert.deepEqual((await json('/bootstrap')).tasks,[]);const drawn=await json('/stage-finance/draw','POST',{stage:1});assert.equal(drawn.task.id,'secret-wife');const combined=await json('/stage-finance/draw','POST',{stage:1,includeSnapshot:true});assert.equal(combined.offer.id,drawn.id);assert.equal(combined.snapshot.offer.id,drawn.id);assert.equal(combined.snapshot.wallet.available,(await json('/stage-finance')).wallet.available);assert.ok(combined.snapshot.assignments.every(r=>r.owner_id===combined.snapshot.profile.user_id));assert.equal((await json('/bootstrap')).wallet.held,0);a=await json('/assignments','POST',{taskId:drawn.task.id});assert.equal((await json('/assignments','POST',{taskId:'secret-wife'})).id,a.id);assert.equal((await json('/bootstrap')).wallet.available,170000);});
 await t.test('non-image and oversized image rejected',async()=>{const r=await request('/assignments/'+a.id+'/uploads','POST',{name:'script.svg',data:Buffer.from('<svg onload="alert(1)">some content</svg>').toString('base64')});assert.equal(r.status,400);const r2=await request('/assignments/'+a.id+'/uploads','POST',{name:'large.png',data:Buffer.alloc(5*1024*1024+1).toString('base64')});assert.equal(r2.status,400);});
 await t.test('uploaded bytes have safe paths and are served correctly',async()=>{for(let i=0;i<3;i++){const u=await json('/assignments/'+a.id+'/uploads','POST',{name:i===0?'../../source.png':`proof-${i}.png`,data:screenshot.toString('base64')});assert.match(u.path,/^\/uploads\/[a-f0-9-]+\.png$/);uploads.push(u.id);const r=await fetch(base+u.path,{headers:{Cookie:cookie}});assert.equal(r.headers.get('content-type'),'image/png');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(Buffer.from(await r.arrayBuffer()),screenshot);}});
 await t.test('duplicate links do not advance status',async()=>{const r=await request('/assignments/'+a.id+'/submit','POST',{links:['https://example.com/a','https://example.com/a','https://example.com/c'],uploadIds:uploads});assert.equal(r.status,400);assert.equal((await json('/assignments/'+a.id)).status,'active');});
 await t.test('revision and approval settle exactly once',async()=>{const payload={links:['https://example.com/a','https://example.com/b','https://example.com/c'],uploadIds:uploads,note:'HTTP acceptance test'};await json('/assignments/'+a.id+'/submit','POST',payload);await json('/assignments/'+a.id+'/review','POST',{decision:'changes',reason:'补充信息'});assert.equal((await json('/assignments/'+a.id)).status,'revision');await json('/assignments/'+a.id+'/submit','POST',payload);await json('/assignments/'+a.id+'/review','POST',{decision:'approve'});await json('/assignments/'+a.id+'/review','POST',{decision:'approve'});const s=await json('/bootstrap');assert.equal(s.wallet.available,204500);assert.equal(s.wallet.earned,4500);assert.equal(s.ledger.length,5);});
 await t.test('restart preserves money, submission history and files',async()=>{await stop();await start();const s=await json('/bootstrap');assert.equal((await json('/admin/session')).authenticated,true);assert.equal(s.wallet.available,204500);assert.equal(s.assignments[0].submissions.length,2);assert.equal(s.assignments[0].uploads.length,3);assert.equal((await fetch(base+s.assignments[0].uploads[0].path,{headers:{Cookie:cookie}})).status,200);});
 await t.test('material upload, byte ranges, archive and restore',async()=>{
  async function upload(name,bytes){const form=new FormData();form.append('file',new Blob([bytes]),name);return fetch(base+'/api/tasks/secret-wife/materials',{method:'POST',headers:{'X-Workspace-Request':'1',Cookie:cookie},body:form});}
  assert.equal((await upload('bad.exe',Buffer.from('not a video'))).status,400);
  assert.equal((await upload('bad.txt',Buffer.from([255,254,0]))).status,400);
  const bytes=Buffer.from('UTF-8 local acceptance document');const r=await upload('acceptance.txt',bytes);assert.equal(r.status,201);const material=await r.json();
  assert.equal((await json('/tasks/secret-wife')).materials.length,1);
  const materialCreatorCookie=cookie.split('; ').find(value=>value.startsWith('drama_creator_'));assert.ok(materialCreatorCookie);assert.equal((await fetch(base+material.path,{headers:{Cookie:materialCreatorCookie}})).status,200);
  const partial=await fetch(base+material.path,{headers:{Cookie:cookie,Range:'bytes=0-4'}});assert.equal(partial.status,206);assert.equal(partial.headers.get('content-range'),`bytes 0-4/${bytes.length}`);assert.equal(await partial.text(),'UTF-8');
  const head=await fetch(base+material.path,{method:'HEAD',headers:{Cookie:cookie}});assert.equal(Number(head.headers.get('content-length')),bytes.length);assert.equal((await head.arrayBuffer()).byteLength,0);
  const invalid=await fetch(base+material.path,{headers:{Cookie:cookie,Range:'bytes=999-'}});assert.equal(invalid.status,416);assert.equal(invalid.headers.get('content-range'),`bytes */${bytes.length}`);
  await json('/materials/'+material.id,'DELETE');assert.equal((await json('/tasks/secret-wife')).materials.length,0);assert.equal((await json('/tasks/secret-wife/materials?all=1')).materials.length,1);assert.equal((await fetch(base+material.path,{headers:{Cookie:cookie}})).status,200);
  for(const method of ['GET','HEAD'])assert.equal((await fetch(base+material.path,{method,headers:{Cookie:materialCreatorCookie}})).status,404);
  await json('/materials/'+material.id+'/restore','POST');await stop();await start();assert.equal((await json('/tasks/secret-wife')).materials.length,1);assert.deepEqual(Buffer.from(await (await fetch(base+material.path,{headers:{Cookie:cookie}})).arrayBuffer()),bytes);
 });
 await t.test('complete backup restores ledger and binary media into a new directory',async()=>{
  const r=await request('/export/backup');assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/gzip/);const archive=join(folder,'acceptance.tar.gz');await writeFile(archive,Buffer.from(await r.arrayBuffer()));
  const restored=join(folder,'restored');const result=await restoreBackup(archive,restored);assert.equal(result.files,6);
  const {createStore}=await import('../server/store.mjs');const restoredStore=createStore(join(restored,'workspace.sqlite'));try{assert.equal(restoredStore.asUser(creatorId,()=>restoredStore.summary()).wallet.available,204500);assert.equal(restoredStore.asUser(creatorId,()=>restoredStore.summary()).assignments[0].submissions.length,2);const upload=restoredStore.asUser(creatorId,()=>restoredStore.summary()).assignments[0].uploads[0];assert.deepEqual(await readFile(join(restored,upload.path.slice(1))),screenshot);assert.equal(restoredStore.getTask('secret-wife').materials.length,1);}finally{restoredStore.close();}
  await assert.rejects(()=>restoreBackup(archive,restored),e=>e.code==='EEXIST');assert.ok((await readFile(join(restored,'workspace.sqlite'))).length>0);
  const bad=join(folder,'broken.tar.gz');await writeFile(bad,(await readFile(archive)).subarray(0,100));const failed=join(folder,'failed');await assert.rejects(()=>restoreBackup(bad,failed));await assert.rejects(()=>readFile(join(failed,'workspace.sqlite')),e=>e.code==='ENOENT');
 });
 await t.test('claimed financial rules are locked and admin changes are audited',async()=>{
  assert.equal((await request('/tasks/secret-wife','PATCH',{commission:999})).status,409);assert.equal((await request('/tasks/secret-wife','PATCH',{cover:'/art/nonexistent.webp'})).status,400);
  const changed=await json('/tasks/secret-wife','PATCH',{description:'Updated task description'});assert.equal(changed.description,'Updated task description');assert.equal(changed.commission,4500);
  const integrity=await json('/admin/integrity','POST',{});assert.equal(integrity.ok,true);assert.deepEqual(integrity.checks,{database:true,relations:true,ledger:true});
  assert.ok((await json('/admin/bootstrap')).audit.some(a=>a.action==='task.update'));
 });
 await t.test('CSV export and invalid task state updates',async()=>{const r=await request('/export/ledger');assert.match(r.headers.get('content-type'),/text\/csv/);assert.match(await r.text(),/2045\.00/);assert.equal((await request('/tasks/secret-wife/active','PATCH',{active:'false'})).status,400);});
 await t.test('cross-account HTTP isolation, sessions and invitation revocation',async()=>{
  const ownerCookie=cookie,invite=await json('/admin/invitations','POST',{maxUses:1,days:1});
  const r=await request('/auth/register','POST',{email:'second@example.com',password:'Second-Test-Password!',inviteCode:invite.code});assert.equal(r.status,201);const secondUser=(await r.json()).user;await json('/admin/finance/account/'+secondUser.id+'/adjust','POST',{amount:'2000',direction:'credit',note:'Explicit second account QA funding',operationKey:'second-api-fixture-funding'});const secondCookie=r.headers.get('set-cookie').split(';')[0];cookie=secondCookie;
  assert.equal((await json('/bootstrap')).assignments.length,0);assert.equal((await request('/assignments/'+a.id)).status,404);assert.equal((await request('/assignments/'+a.id+'/draft','PATCH',{note:'attack'})).status,404);
  assert.equal((await request('/tasks/secret-wife')).status,404);const secondIdentity=await json('/finance/identity','POST',{name:'测试用户',documentType:'居民身份证',number:'11000020000101000X',frontPhoto:{data:screenshot.toString('base64')},backPhoto:{data:screenshot.toString('base64')}});assert.equal((await request('/admin/finance/identity/'+secondIdentity.id+'/review','POST',{decision:'approve'},{Cookie:ownerCookie})).status,200);const revealed=await json('/stage-finance/draw','POST',{stage:1});const own=await json('/assignments','POST',{taskId:revealed.task.id});assert.notEqual(own.id,a.id);assert.equal((await request('/admin/accounts')).status,401);
  const snapshot=await fetch(base+(await json('/assignments/'+own.id)).task.cover);assert.equal(snapshot.status,200);
  const proof=await request('/assignments/'+a.id);assert.equal(proof.status,404);
  cookie=ownerCookie;const owner=await json('/assignments/'+a.id);assert.equal((await fetch(base+owner.uploads[0].path,{headers:{Cookie:secondCookie}})).status,404);assert.equal((await fetch(base+owner.uploads[0].path)).status,401);
  const expired=await json('/admin/invitations','POST',{});await json('/admin/invitations/'+expired.id+'/revoke','POST',{});assert.equal((await request('/auth/register','POST',{email:'disabled@example.com',password:'Third-Test-Password!',inviteCode:expired.code})).status,400);
  const integrity=await json('/admin/integrity','POST',{});assert.equal(integrity.ok,true);
  cookie=secondCookie;await json('/auth/logout','POST',{});assert.equal((await request('/bootstrap')).status,401);cookie=ownerCookie;
 });
 await t.test('finance HTTP approvals, freeze and encrypted backup recovery',async()=>{
  const {randomUUID}=await import('node:crypto');
  assert.equal((await request('/admin/finance','GET',undefined,{Cookie:''})).status,401);
  const k=(await json('/finance')).identity||await json('/finance/identity','POST',{name:'测试用户',documentType:'居民身份证',number:'11000020000101000X',frontPhoto:{data:screenshot.toString('base64')},backPhoto:{data:screenshot.toString('base64')}});assert.ok(['review','approved'].includes(k.status));assert.equal(k.has_photos,true);assert.equal((await fetch(base+'/api/finance/identity/'+k.id+'/photos/front',{headers:{Cookie:cookie}})).status,200);assert.equal((await fetch(base+'/api/finance/identity/'+k.id+'/photos/front')).status,401);
  if(k.status==='review')await json('/admin/finance/identity/'+k.id+'/review','POST',{decision:'approve'});
  await json('/finance/cards','POST',{bank:'验收银行',holder:'测试用户',number:'0000000000001234'});const card=(await json('/finance')).cards[0];assert.equal(card.status,'review');
  await json('/admin/finance/bank/'+card.id+'/review','POST',{decision:'approve'});
  const deposit=await json('/finance/requests','POST',{kind:'deposit',amount:'12.50',reference:'QA-API-deposit',operationKey:randomUUID()});assert.equal(deposit.status,'review');
  await json('/admin/finance/fund/'+deposit.id+'/review','POST',{decision:'approve',confirmReceived:true});
  const before=(await json('/bootstrap')).wallet.available;
  assert.equal((await request('/auth/fund-password','GET',undefined,{Cookie:''})).status,401);
  const unsafeWithdrawal={kind:'withdrawal',amount:'1',cardId:card.id,operationKey:randomUUID()};
  assert.equal((await request('/finance/requests','POST',unsafeWithdrawal)).status,409);
  const setup={loginPassword:'Creator-Test-Password!',newPassword:'24681357',confirmPassword:'24681357'};
  assert.equal((await request('/auth/fund-password','POST',setup,{Origin:'https://attacker.invalid'})).status,403);
  assert.equal((await request('/auth/fund-password','POST',{...setup,loginPassword:'wrong'})).status,400);
  assert.equal((await json('/auth/fund-password')).configured,false);await json('/auth/fund-password','POST',{loginPassword:'Creator-Test-Password!',newPassword:'24681357',confirmPassword:'24681357'});
  assert.equal((await request('/finance/requests','POST',{...unsafeWithdrawal,fundPassword:'wrong'})).status,400);
  assert.equal((await request('/finance/requests','POST',unsafeWithdrawal)).status,400);
  assert.equal((await json('/bootstrap')).wallet.available,before);
  assert.deepEqual(await json('/auth/fund-password'),{configured:true});
  const bankRejected=await request('/finance/requests','POST',{kind:'withdrawal',fundPassword:'24681357',amount:'499.99',cardId:card.id,operationKey:randomUUID()});assert.equal(bankRejected.status,400);assert.equal((await json('/bootstrap')).wallet.available,before);
  await json('/finance/cards','POST',{provider:'okx',number:'12345678'});const payout=(await json('/finance')).cards.find(c=>c.provider==='okx');
  const withdraw=await json('/finance/requests','POST',{kind:'withdrawal',fundPassword:'24681357',amount:'10.25',cardId:payout.id,operationKey:randomUUID()});assert.equal((await json('/bootstrap')).wallet.available,before-1025);
  const [first,second]=await Promise.all([request('/admin/finance/fund/'+withdraw.id+'/review','POST',{decision:'approve'}),request('/admin/finance/fund/'+withdraw.id+'/review','POST',{decision:'approve'})]);assert.deepEqual([first.status,second.status].sort(),[200,409]);
  assert.equal((await json('/finance')).requests.find(r=>r.id===withdraw.id).status,'paying');await json('/admin/finance/fund/'+withdraw.id+'/review','POST',{decision:'paid',reference:'QA-API-payment-reference'});assert.equal((await json('/finance')).requests.find(r=>r.id===withdraw.id).status,'paid');
  await json('/admin/finance/account/'+creatorId+'/freeze','POST',{frozen:true,reason:'QA HTTP freeze'});assert.equal((await request('/bootstrap')).status,401);assert.equal((await request('/auth/login','POST',{email:'acceptance@example.com',password:'Creator-Test-Password!'})).status,403);
  await json('/admin/finance/account/'+creatorId+'/freeze','POST',{frozen:false,reason:'QA HTTP unfreeze'});const login=await request('/auth/login','POST',{email:'acceptance@example.com',password:'Creator-Test-Password!'});assert.equal(login.status,200);cookie=cookie.split(';').map(v=>v.trim()).filter(v=>!v.startsWith('drama_creator_')).join('; ')+'; '+login.headers.get('set-cookie').split(';')[0];
  assert.equal((await json('/admin/integrity','POST',{})).ok,true);
  const archive=join(folder,'finance-backup.tar.gz');await writeFile(archive,Buffer.from(await (await request('/export/backup')).arrayBuffer()));const restored=join(folder,'finance-restored');await restoreBackup(archive,restored);
  const {createStore}=await import('../server/store.mjs'),{createFinance}=await import('../server/finance.mjs');const restoredStore=createStore(join(restored,'workspace.sqlite'));try{const f=createFinance(restoredStore,restored);assert.equal(f.reveal('qa-admin','identity',k.id).number,'11000020000101000X');assert.equal(f.snapshot(creatorId).requests.find(r=>r.id===withdraw.id).status,'paid');}finally{restoredStore.close();}
 });
 await t.test('super admin creates isolated agent backends with permanent short invitations',async()=>{
  const superCookie=cookie,agentA=await json('/admin/agents','POST',{username:'agent-one',password:'Agent1234'}),agentB=await json('/admin/agents','POST',{username:'agent-two',password:'Agent5678'});
  const loginA=await request('/admin/login','POST',{username:'agent-one',password:'Agent1234'}),loginB=await request('/admin/login','POST',{username:'agent-two',password:'Agent5678'}),cookieA=loginA.headers.get('set-cookie').split(';')[0],cookieB=loginB.headers.get('set-cookie').split(';')[0];assert.equal((await loginA.json()).role,'agent');assert.equal((await request('/admin/deposit-channels','GET',undefined,{Cookie:cookieA})).status,403);assert.equal((await request('/admin/deposit-channels','POST',{revision:1,channels:[]},{Cookie:cookieA})).status,403);
  const call=(token,path,method='GET',input)=>request(path,method,input,{Cookie:token});const data=async(token,path,method,input)=>{const r=await call(token,path,method,input),b=await r.json();assert.ok(r.ok,JSON.stringify(b));return b;};
  const invitesA=await data(cookieA,'/admin/invitations','POST',{count:2,label:'Agent A'}),invitesB=await data(cookieB,'/admin/invitations','POST',{count:1,label:'Agent B'});assert.equal(invitesA.codes.length,2);for(const i of invitesA.codes)assert.match(i.code,/^[A-Z2-9]{8}$/);
  async function register(email,inviteCode){const r=await request('/auth/register','POST',{email,password:'Client1234',inviteCode},{Cookie:''});assert.equal(r.status,201);return {user:(await r.json()).user,cookie:r.headers.get('set-cookie').split(';')[0]};}
  const clientA=await register('agent-a-client@example.com',invitesA.code),clientB=await register('agent-b-client@example.com',invitesB.code);assert.equal((await data(clientA.cookie,'/bootstrap')).wallet.available,100);
  assert.equal((await call(clientA.cookie,'/admin/overview')).status,401);
  const channelBefore=await data(superCookie,'/admin/deposit-channels');
  for(const supportUrl of ['javascript:alert(1)','http://unsafe.invalid','https://user:password@example.invalid'])assert.equal((await call(superCookie,'/admin/deposit-channels','POST',{...channelBefore,supportUrl})).status,400);
  const routeA={id:'qa-tron',asset:'USDT',network:'TRON · TRC20',address:'QA-ONLY-TRON-ADDRESS',memo:'QA-ONLY-TAG'},routeB={id:'qa-eth',asset:'USDT',network:'Ethereum · ERC20',address:'QA-ONLY-ETH-ADDRESS',memo:''};
  const channelSaved=await data(superCookie,'/admin/deposit-channels','POST',{...channelBefore,supportUrl:'https://support.example.invalid/chat',channels:channelBefore.channels.map(c=>c.id==='binance'?{...c,uid:'12345678',asset:'USDT',routes:[routeA,routeB]}:c)});
  for(const token of [clientA.cookie,clientB.cookie]){const visible=await data(token,'/finance/deposit-channels');assert.deepEqual(visible,channelSaved);assert.equal((await call(token,'/admin/deposit-channels')).status,401);assert.equal((await call(token,'/admin/deposit-channels','POST',channelSaved)).status,401);}
  assert.equal((await call('','/finance/deposit-channels')).status,401);
  const depositInput={kind:'deposit',amount:'12.34',reference:'QA-route-sync-A',operationKey:'qa-route-sync-A-2026',depositChannel:'binance',depositMethod:'uid'};
  const receiptA=await data(clientA.cookie,'/finance/requests','POST',depositInput);assert.equal(receiptA.deposit_method,'uid');assert.equal((await data(clientA.cookie,'/finance/requests','POST',depositInput)).id,receiptA.id);
  assert.equal((await call(clientA.cookie,'/finance/requests','POST',{...depositInput,depositMethod:'qa-tron'})).status,409);
  const receiptB=await data(clientB.cookie,'/finance/requests','POST',{...depositInput,reference:'QA-route-sync-B',operationKey:'qa-route-sync-B-2026',depositMethod:'qa-tron'});assert.equal(receiptB.deposit_method_label,'USDT · TRON · TRC20');
  for(const [person,own,other] of [[clientA,receiptA,receiptB],[clientB,receiptB,receiptA]]){const finance=await data(person.cookie,'/finance?customer='+other.user_id);assert.ok(finance.requests.some(r=>r.id===own.id));assert.ok(!finance.requests.some(r=>r.id===other.id));assert.equal(finance.account.available,100);}
  assert.ok((await data(cookieA,'/admin/finance')).requests.some(r=>r.id===receiptA.id));assert.ok(!(await data(cookieA,'/admin/finance')).requests.some(r=>r.id===receiptB.id));assert.equal((await call(cookieA,'/admin/finance/fund/'+receiptB.id+'/review','POST',{decision:'approve',confirmReceived:true})).status,403);
  for(const depositMethod of ['', 'not-a-network'])assert.equal((await call(clientA.cookie,'/finance/requests','POST',{...depositInput,operationKey:'qa-wrong-route-'+Date.now(),reference:'QA-wrong-'+Date.now(),depositMethod})).status,409);
  assert.equal((await call(clientA.cookie,'/finance/requests','POST',{...depositInput,operationKey:'qa-bank-contact-2026',depositChannel:'bank_wire'})).status,409);
  await stop();await start();assert.deepEqual(await data(clientA.cookie,'/finance/deposit-channels'),channelSaved);assert.ok((await data(clientB.cookie,'/finance')).requests.some(r=>r.id===receiptB.id));

  const fundPath='/admin/accounts/'+clientA.user.id+'/fund-password',foreignFundPath='/admin/accounts/'+clientB.user.id+'/fund-password';
  assert.equal((await data(cookieA,fundPath)).configured,false);
  const resetFund={newPassword:'13572468',confirmPassword:'13572468',confirmed:true};
  assert.equal((await call(clientA.cookie,fundPath)).status,401);
  for(const verb of ['GET','POST'])assert.equal((await call(cookieA,foreignFundPath,verb,verb==='POST'?resetFund:undefined)).status,403);
  assert.equal((await call(cookieA,fundPath,'POST',{...resetFund,confirmed:false})).status,400);
  assert.equal((await data(cookieA,fundPath,'POST',resetFund)).configured,true);
  assert.equal((await data(clientA.cookie,'/auth/fund-password')).configured,true);
  assert.equal((await data(superCookie,foreignFundPath,'POST',resetFund)).configured,true);
  assert.ok(!JSON.stringify(await data(superCookie,'/admin/bootstrap')).includes(resetFund.newPassword));
  const planPath='/admin/plan-dispatch/'+clientA.user.id;
  await data(cookieA,planPath,'POST',{planDay:1,revision:0,standard:null,slots:{},balancePricing:{minPercent:'20.25',maxPercent:'74.99'}});
  assert.deepEqual((await data(cookieA,planPath)).plans[0].configuration.balancePricing,{minPercent:20.25,maxPercent:74.99});
  assert.equal((await call(cookieA,planPath,'POST',{planDay:1,revision:1,standard:null,slots:{},balancePricing:{minPercent:19,maxPercent:75}})).status,400);

  await data(cookieA,planPath,'POST',{planDay:1,revision:1,standard:null,slots:{},balancePricing:null,randomPricing:{minAmount:'123.45',maxAmount:'678.90'}});
  assert.deepEqual((await data(cookieA,planPath)).plans[0].configuration.randomPricing,{minAmount:12345,maxAmount:67890});
  assert.equal((await data(cookieB,'/admin/plan-dispatch/'+clientB.user.id)).plans[0].configuration.randomPricing,undefined);
  assert.equal((await call(cookieA,planPath,'POST',{planDay:1,revision:2,standard:null,slots:{},randomPricing:{minAmount:200,maxAmount:100}})).status,400);
  assert.equal((await call(cookieB,planPath,'POST',{planDay:1,revision:2,standard:null,slots:{},randomPricing:{minAmount:1,maxAmount:2}})).status,403);

  await data(cookieA,'/admin/accounts/'+clientA.user.id+'/customer-type','POST',{customerType:'test'});
  assert.equal((await call(cookieA,'/admin/accounts/'+clientB.user.id+'/customer-type','POST',{customerType:'test'})).status,403);
  assert.equal((await call(cookieA,'/admin/accounts/'+clientA.user.id+'/customer-type','POST',{customerType:'invalid'})).status,400);
  assert.equal((await data(cookieA,'/admin/accounts?customerType=test')).users.length,1);
  assert.equal((await data(cookieB,'/admin/accounts?customerType=test')).users.length,0);
  assert.equal((await call(cookieA,'/admin/accounts?customerType=invalid')).status,400);
  const ownOverview=await data(cookieA,'/admin/overview');assert.equal(ownOverview.groups.test.customers,1);assert.equal(ownOverview.groups.real.customers,0);assert.ok(!JSON.stringify(ownOverview).includes(clientB.user.email));
  const aAccounts=await data(cookieA,'/admin/accounts');assert.equal(aAccounts.users.length,1);assert.equal(aAccounts.users[0].id,clientA.user.id);assert.equal(aAccounts.invitations.length,2);assert.ok(!JSON.stringify(aAccounts).includes('agent-b-client'));
  assert.equal((await data(cookieB,'/admin/accounts')).users[0].id,clientB.user.id);assert.ok((await data(superCookie,'/admin/accounts')).users.length>=4);
  const ownDetail=await data(cookieA,'/admin/customers/'+clientA.user.id);assert.equal(ownDetail.customer.id,clientA.user.id);assert.equal(ownDetail.progress.stage,1);assert.ok(ownDetail.ledger.every(l=>l.owner_id===clientA.user.id));assert.ok(!JSON.stringify(ownDetail).includes(clientB.user.email));
  assert.equal((await data(superCookie,'/admin/customers/'+clientB.user.id)).customer.id,clientB.user.id);
  assert.equal((await call(clientA.cookie,'/admin/customers/'+clientA.user.id)).status,401);
  for(const path of ['/admin/customers/'+clientB.user.id,'/admin/finance?customer='+clientB.user.id,'/admin/premium-dispatch?customer='+clientB.user.id,'/admin/stage-enrollments?customer='+clientB.user.id,'/admin/plan-dispatch/'+clientB.user.id])assert.equal((await call(cookieA,path)).status,403);
  const ownFinance=await data(cookieA,'/admin/finance?customer='+clientA.user.id);assert.deepEqual(ownFinance.users.map(u=>u.id),[clientA.user.id]);
  assert.deepEqual((await data(cookieA,'/admin/premium-dispatch?customer='+clientA.user.id)).customers.map(u=>u.id),[clientA.user.id]);
  const adjust={amount:'50',direction:'credit',note:'Agent fixture funding',operationKey:'agent-a-explicit-funding'};assert.equal((await call(cookieA,'/admin/finance/account/'+clientA.user.id+'/adjust','POST',adjust)).status,200);await data(superCookie,'/admin/finance/account/'+clientA.user.id+'/adjust','POST',adjust);assert.equal((await call(cookieA,'/admin/finance/account/'+clientB.user.id+'/adjust','POST',adjust)).status,403);assert.equal((await call(cookieA,'/admin/finance/account/'+clientB.user.id+'/freeze','POST',{frozen:true,reason:'blocked attempt'})).status,403);
  const campaign=await data(superCookie,'/admin/activity-rewards','POST',{name:'HTTP 活动参与奖励',amount:'1.25',budget:'1.25',operatorId:agentA.id});
  assert.equal((await call(cookieA,'/admin/activity-rewards','POST',{name:'越权活动',amount:'1',budget:'1',operatorId:agentA.id})).status,403);
  const grantInput={userId:clientA.user.id,reason:'HTTP 已核对参与记录',operationKey:'http-reward-unique-operation',confirm:true};
  const granted=await data(cookieA,'/admin/activity-rewards/'+campaign.id+'/grant','POST',grantInput);
  assert.equal(granted.amount,125);assert.equal((await data(cookieA,'/admin/activity-rewards/'+campaign.id+'/grant','POST',grantInput)).id,granted.id);
  assert.equal((await data(clientA.cookie,'/bootstrap')).wallet.available,5225);
  assert.equal((await call(cookieB,'/admin/activity-rewards/'+campaign.id+'/grant','POST',{...grantInput,userId:clientB.user.id,operationKey:'http-reward-foreign-operation'})).status,403);
  assert.equal((await data(cookieB,'/admin/activity-rewards')).grants.length,0);
  assert.equal((await call(clientA.cookie,'/admin/activity-rewards')).status,401);
  for(const path of ['/admin/agents','/manage/tasks','/export/backup','/export/workspace'])assert.equal((await call(cookieA,path)).status,403);assert.equal((await call(cookieA,'/tasks','POST',{})).status,403);
  const identity=await data(clientB.cookie,'/finance/identity','POST',{name:'测试客户',documentType:'驾驶证',number:'TEST-DRIVER-002',frontPhoto:{data:screenshot.toString('base64')},backPhoto:{data:screenshot.toString('base64')}});
  assert.equal((await call(cookieA,'/admin/finance/identity/'+identity.id+'/reveal','POST',{})).status,403);assert.equal((await call(cookieA,'/admin/finance/identity/'+identity.id+'/photos/front')).status,403);assert.equal((await call(cookieB,'/admin/finance/identity/'+identity.id+'/photos/front')).status,200);assert.equal((await call(clientA.cookie,'/finance/identity/'+identity.id+'/photos/back')).status,404);
  const deposit=await data(clientB.cookie,'/finance/requests','POST',{kind:'deposit',amount:'20',reference:'agent-b-deposit-reference',operationKey:'agent-b-deposit-request'});assert.equal((await call(cookieA,'/admin/finance/fund/'+deposit.id+'/review','POST',{decision:'approve',confirmReceived:true})).status,403);await data(cookieB,'/admin/finance/fund/'+deposit.id+'/review','POST',{decision:'approve',confirmReceived:true});
  const summaryA=await data(cookieA,'/admin/bootstrap');assert.equal(summaryA.wallet.available,5225);assert.equal(summaryA.creators.length,1);assert.equal(summaryA.assignments.length,0);assert.ok(!JSON.stringify(summaryA).includes('agent-b-client'));const financeA=await data(cookieA,'/admin/finance');assert.equal(financeA.users.length,1);assert.equal(financeA.identities.length,0);assert.deepEqual(financeA.requests.map(r=>r.id),[receiptA.id]);
  assert.equal((await call(cookieA,'/admin/invitations/'+invitesB.id+'/revoke','POST',{})).status,403);await data(cookieA,'/admin/invitations/'+invitesA.codes[1].id+'/revoke','POST',{});assert.equal((await data(cookieA,'/admin/accounts')).users[0].id,clientA.user.id);
  assert.equal((await call(clientA.cookie,'/admin/accounts/'+clientB.user.id+'/password','POST',{mode:'reset'})).status,401);
  assert.equal((await call(cookieA,'/admin/accounts/'+clientB.user.id+'/password','POST',{mode:'reset'})).status,403);
  assert.equal((await call(cookieB,'/admin/accounts/'+clientB.user.id+'/password','POST',{mode:'change',password:'short'})).status,400);
  const resetResponse=await call(cookieB,'/admin/accounts/'+clientB.user.id+'/password','POST',{mode:'reset'});assert.equal(resetResponse.status,200);assert.equal(resetResponse.headers.get('cache-control'),'no-store');const reset=await resetResponse.json();assert.ok(reset.temporaryPassword);assert.equal((await call(clientB.cookie,'/bootstrap')).status,401);
  assert.equal((await call('','/auth/login','POST',{email:clientB.user.email,password:'Client1234'})).status,401);
  assert.equal((await call('','/auth/login','POST',{email:clientB.user.email,password:reset.temporaryPassword})).status,200);
  assert.ok(!JSON.stringify(await data(cookieB,'/admin/accounts')).includes(reset.temporaryPassword));
  await stop();await start();assert.equal((await data(cookieA,'/admin/accounts?customerType=test')).users[0].id,clientA.user.id);assert.equal((await data(cookieB,'/admin/session')).role,'agent');assert.equal((await data(cookieB,'/admin/accounts')).users[0].id,clientB.user.id);
  await data(superCookie,'/admin/agents/'+agentA.id+'/state','PATCH',{active:false});assert.equal((await call(cookieA,'/admin/accounts')).status,401);assert.equal((await request('/auth/register','POST',{email:'disabled-agent-client@example.com',password:'Client1234',inviteCode:invitesA.code},{Cookie:''})).status,400);cookie=superCookie;
 });
 await t.test('customer directory metadata, creator-admin separation and forced logout',async()=>{
  const invite=await json('/admin/invitations','POST',{label:'Metadata QA'});
  const registered=await request('/auth/register','POST',{email:'metadata-check@example.com',password:'Metadata1234',inviteCode:invite.code,country:'GE'},{Cookie:'','X-Forwarded-For':'8.8.8.8','User-Agent':'Metadata QA browser'});
  assert.equal(registered.status,201);const user=(await registered.json()).user,customerCookie=registered.headers.get('set-cookie').split(';')[0];
  assert.equal(user.country,'');
  for(const path of ['/admin/accounts','/manage/tasks','/export/backup','/export/workspace','/assets'])assert.equal((await request(path,'GET',undefined,{Cookie:customerCookie})).status,401);
  assert.equal((await request('/tasks','POST',{}, {Cookie:customerCookie})).status,401);
  assert.equal((await request('/admin/accounts/'+user.id+'/notes','POST',{note:'unauthorized'}, {Cookie:customerCookie})).status,401);
  assert.equal((await request('/admin/accounts/'+user.id+'/revoke-sessions','POST',{}, {Cookie:customerCookie})).status,401);
  await json('/admin/accounts/'+user.id+'/notes','POST',{note:'Follow-up visible to admin only'});
  const rows=(await json('/admin/accounts')).users,entry=rows.find(r=>r.id===user.id);assert.equal(entry.registration_ip,'127.0.0.1');assert.equal(entry.last_login_ip,'127.0.0.1');assert.equal(entry.country_source,'private');assert.equal(entry.last_login_agent,'Metadata QA browser');assert.equal(entry.admin_note,'Follow-up visible to admin only');assert.equal(entry.wallet.total,100);assert.equal(entry.identity_status,'not_submitted');
  const session=await(await request('/auth/session','GET',undefined,{Cookie:customerCookie})).json();assert.ok(!JSON.stringify(session).includes('Follow-up'));assert.ok(!JSON.stringify(session).includes('password_hash'));
  await json('/admin/accounts/'+user.id+'/revoke-sessions','POST',{});assert.equal((await request('/bootstrap','GET',undefined,{Cookie:customerCookie})).status,401);assert.equal((await json('/admin/session')).authenticated,true);
 });
 await t.test('retired preview endpoints cannot calculate or grant stage eligibility',async()=>{
  assert.equal((await request('/journey','PATCH',{kind:'newcomer',value:{stage:6}})).status,410);
  assert.equal((await request('/stage-three/example','POST',{source:'demo',balance:'100'})).status,410);
  assert.equal((await request('/stage-three/premium-reveal','POST',{sequence:20})).status,410);
 });
 await t.test('logout invalidates the stored session',async()=>{await json('/admin/logout','POST',{});assert.equal((await request('/admin/bootstrap')).status,401);assert.equal((await json('/admin/session')).authenticated,false);});
 }finally{await stop();const target=resolve(folder);if(!target.startsWith(work+requireSeparator()))throw new Error('Unsafe test cleanup path');await rm(target,{recursive:true,force:true});}});
function requireSeparator(){return process.platform==='win32'?'\\':'/';}
