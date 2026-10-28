import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
const base='http://127.0.0.1:4182';
test('agent-owned deposit and support settings obey independent permissions, inheritance, live customer sync and restart isolation',async()=>{
 const dir=await mkdtemp(resolve('work/scoped-channels-'));let child;
 async function start(){child=spawn(process.execPath,['server/index.mjs','--production','--port','4182'],{env:{...process.env,DRAMA_DATA_DIR:dir},windowsHide:true,stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);for(let i=0;i<200&&!log.includes('Drama Studio 2.0:');i++){if(child.exitCode!==null)throw Error(log);await new Promise(r=>setTimeout(r,25));}assert.ok(log.includes('Drama Studio 2.0:'),log);}
 async function stop(){if(child?.exitCode===null){child.kill();await once(child,'exit');}}
 async function call(token,path,input){return fetch(base+'/api'+path,{method:input?'POST':'GET',headers:{Cookie:token,'Content-Type':'application/json','X-Workspace-Request':'1'},body:input?JSON.stringify(input):undefined});}
 async function data(token,path,input){const r=await call(token,path,input),b=await r.json();assert.ok(r.ok,path+': '+JSON.stringify(b));return b;}
 async function session(path,input){const r=await call('',path,input),body=await r.json();assert.ok(r.ok,JSON.stringify(body));return {token:r.headers.get('set-cookie').split(';')[0],body};}
 try{await start();const master=(await session('/admin/setup',{username:'scoped-master',password:'ScopedAudit2026!'})).token;
 const a=await data(master,'/admin/agents',{username:'scoped-a',password:'ScopedAudit2026!'}),b=await data(master,'/admin/agents',{username:'scoped-b',password:'ScopedAudit2026!'});
 const ta=(await session('/admin/login',{username:a.username,password:'ScopedAudit2026!'})).token,tb=(await session('/admin/login',{username:b.username,password:'ScopedAudit2026!'})).token;
 const ia=await data(ta,'/admin/invitations',{count:1}),ib=await data(tb,'/admin/invitations',{count:1}),im=await data(master,'/admin/invitations',{count:1});
 const ca=await session('/auth/register',{email:'scoped-a@audit.invalid',password:'Customer2026!',inviteCode:ia.code}),cb=await session('/auth/register',{email:'scoped-b@audit.invalid',password:'Customer2026!',inviteCode:ib.code}),cm=await session('/auth/register',{email:'scoped-master@audit.invalid',password:'Customer2026!',inviteCode:im.code});
 let global=await data(master,'/admin/deposit-channels');global=await data(master,'/admin/deposit-channels',{...global,supportUrl:'https://global.example.invalid/chat',channels:global.channels.map(c=>c.id==='binance'?{...c,uid:'99999999',asset:'USDT',routes:[{id:'global-tron',asset:'USDT',network:'TRC20',address:'QA-GLOBAL',memo:''}]}:c)});
 const customer=token=>data(token,'/finance/deposit-channels');for(const c of [ca,cb,cm])assert.deepEqual(await customer(c.token),global);
 const flags=async(id,depositConfigure,supportConfigure)=>{const p='/admin/agents/'+id+'/permissions',old=await data(master,p);return data(master,p,{revision:old.revision,permissions:{...old.permissions,depositConfigure,supportConfigure}});};
 for(const token of [ta,tb]){assert.equal((await call(token,'/admin/deposit-channels')).status,403);assert.equal((await call(token,'/admin/deposit-channels',global)).status,403);}
 await flags(a.id,true,false);let ownA=await data(ta,'/admin/deposit-channels');const customized=ownA.channels.map(c=>c.id==='binance'?{...c,uid:'11111111',routes:[{id:'agent-a-tron',asset:'USDT',network:'TRC20',address:'QA-AGENT-A',memo:'TAG-A'}]}:c);
 assert.equal((await call(ta,'/admin/deposit-channels',{...ownA,channels:customized,supportUrl:'https://unapproved.example.invalid'})).status,403);
 ownA=await data(ta,'/admin/deposit-channels',{...ownA,channels:customized});assert.equal((await customer(ca.token)).channels.find(c=>c.id==='binance').uid,'11111111');assert.deepEqual(await customer(cb.token),global);assert.deepEqual(await customer(cm.token),global);assert.deepEqual(await data(master,'/admin/deposit-channels'),global);
 for(const path of ['/admin/deposit-channels?owner='+b.id,'/admin/deposit-channels?customer='+cb.body.user.id])assert.equal((await call(ta,path)).status,403);
 assert.equal((await call(ta,'/admin/deposit-channels',{...ownA,ownerId:b.id})).status,403);
 await flags(b.id,false,true);let ownB=await data(tb,'/admin/deposit-channels');assert.equal((await call(tb,'/admin/deposit-channels',{...ownB,channels:customized})).status,403);ownB=await data(tb,'/admin/deposit-channels',{...ownB,supportUrl:'https://b.example.invalid/chat'});assert.equal((await customer(cb.token)).supportUrl,'https://b.example.invalid/chat');assert.equal((await customer(ca.token)).supportUrl,global.supportUrl);
 global=await data(master,'/admin/deposit-channels',{...global,supportUrl:'https://global-new.example.invalid/chat',channels:global.channels.map(c=>c.id==='binance'?{...c,uid:'88888888'}:c)});
 assert.equal((await customer(ca.token)).supportUrl,global.supportUrl);assert.equal((await customer(ca.token)).channels.find(c=>c.id==='binance').uid,'11111111');assert.equal((await customer(cb.token)).channels.find(c=>c.id==='binance').uid,'88888888');assert.equal((await customer(cb.token)).supportUrl,'https://b.example.invalid/chat');assert.deepEqual(await customer(cm.token),global);
 assert.equal((await call(ta,'/admin/deposit-channels',{...ownA,channels:customized})).status,409);
 await flags(a.id,false,true);ownA=await data(ta,'/admin/deposit-channels');const wrong=ownA.channels.map(c=>c.id==='binance'?{...c,uid:'22222222'}:c);assert.equal((await call(ta,'/admin/deposit-channels',{...ownA,channels:wrong})).status,403);ownA=await data(ta,'/admin/deposit-channels',{...ownA,supportUrl:'https://a.example.invalid/chat'});assert.equal((await customer(ca.token)).supportUrl,'https://a.example.invalid/chat');
 const request={kind:'deposit',amount:'12.34',reference:randomUUID(),operationKey:randomUUID(),depositChannel:'binance',depositMethod:'agent-a-tron'};const record=await data(ca.token,'/finance/requests',request);assert.equal(record.user_id,ca.body.user.id);assert.equal((await call(cb.token,'/finance/requests',{...request,reference:randomUUID(),operationKey:randomUUID()})).status,409);assert.ok(!(await data(cb.token,'/finance')).requests.some(r=>r.id===record.id));assert.equal((await call(tb,'/admin/finance/fund/'+record.id+'/review',{decision:'approve',confirmReceived:true})).status,403);
 assert.equal((await data(ca.token,'/finance')).account.available,100);assert.equal((await data(cb.token,'/finance')).account.available,100);
 const beforeA=await customer(ca.token),beforeB=await customer(cb.token);await flags(a.id,false,false);assert.equal((await call(ta,'/admin/deposit-channels')).status,403);assert.equal((await call(ta,'/admin/deposit-channels',ownA)).status,403);assert.deepEqual(await customer(ca.token),beforeA);assert.deepEqual(await customer(cb.token),beforeB);
 await stop();await start();assert.deepEqual(await customer(ca.token),beforeA);assert.deepEqual(await customer(cb.token),beforeB);assert.deepEqual(await customer(cm.token),global);
 }finally{await stop();await rm(dir,{recursive:true,force:true});}
});
