// Isolated sustained workflow verification; never writes to the user's live workspace.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,mkdtemp,appendFile,writeFile,rm} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {restoreBackup} from '../scripts/restore-backup.mjs';
const work=resolve('work'),base='http://127.0.0.1:4183';
const until=Date.parse(process.argv[2]||new Date(Date.now()+60000).toISOString());
if(!Number.isFinite(until)||until<Date.now())throw new Error('Provide a future ISO stop time');
await mkdir(work,{recursive:true});const folder=await mkdtemp(join(work,'soak-data-'));
const log=join(work,'soak-results.ndjson');let child,taskId,cookie="",round=0;const latencies=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function start(){child=spawn(process.execPath,['server/index.mjs','--production','--port','4183'],{env:{...process.env,DRAMA_DATA_DIR:folder},stdio:['ignore','pipe','pipe'],windowsHide:true});let out='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>out+=x);const began=Date.now();while(!out.includes('Drama Studio 2.0:')){if(child.exitCode!==null||Date.now()-began>15000)throw new Error(out||'Startup timeout');await pause(25);}}
async function stop(){if(child&&child.exitCode===null){child.kill();await once(child,'exit');}}
async function request(path,method='GET',body){const began=performance.now();const r=await fetch(base+'/api'+path,{method,headers:{Cookie:cookie,...(method==='GET'?{}:{'Content-Type':'application/json','X-Workspace-Request':'1'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});const value=await r.json();latencies.push(performance.now()-began);if(!r.ok)throw new Error(r.status+': '+JSON.stringify(value));return value;}
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=','base64').toString('base64');
async function record(value){await appendFile(log,JSON.stringify({at:new Date().toISOString(),...value})+'\n');}
await record({event:'start',until:new Date(until).toISOString(),dataDirectory:folder});
try{
 await start();
 const setup=await fetch(base+'/api/admin/setup',{method:'POST',headers:{'Content-Type':'application/json','X-Workspace-Request':'1'},body:JSON.stringify({username:'soak-admin',password:'Isolated-Soak-Test-2026!'})});if(!setup.ok)throw new Error('Test admin setup failed');cookie=setup.headers.get('set-cookie').split(';')[0];
 taskId=(await request('/tasks','POST',{title:'Stability fixture',description:'Isolated high-capacity verification task',platform:'TikTok',language:'\u4e2d\u6587',genre:'stability',deposit:300,commission:45,posts:3,episodes:80,slots:10000,cover:'/art/hero-v2.webp'})).id;
 while(Date.now()<until){
  round++;
  const a=await request('/assignments','POST',{taskId});
  const duplicates=await Promise.all(Array.from({length:6},()=>request('/assignments','POST',{taskId})));assert.ok(duplicates.every(d=>d.id===a.id));
  await Promise.all(Array.from({length:10},()=>request('/bootstrap')));
  if(round%4===0){await Promise.all(Array.from({length:3},()=>request('/assignments/'+a.id+'/cancel','POST',{})));}
  else{
   const uploads=[];for(let i=0;i<3;i++)uploads.push((await request('/assignments/'+a.id+'/uploads','POST',{name:`round-${round}-${i}.png`,data:png})).id);
   const payload={links:uploads.map((_,i)=>`https://example.com/stability/${round}/${i}`),note:'Isolated stability test',uploadIds:uploads};
   await request('/assignments/'+a.id+'/draft','PATCH',payload);await request('/assignments/'+a.id+'/submit','POST',payload);
   if(round%3===0){await request('/assignments/'+a.id+'/review','POST',{decision:'changes',reason:'Stability revision check'});await request('/assignments/'+a.id+'/submit','POST',payload);}
   await Promise.all(Array.from({length:5},()=>request('/assignments/'+a.id+'/review','POST',{decision:'approve'})));
  }
  const s=await request('/bootstrap'),rewards=round-Math.floor(round/4);assert.equal(s.wallet.available,200000+rewards*4500);assert.equal(s.wallet.held,0);assert.equal(s.wallet.earned,rewards*4500);assert.equal(s.assignments.length,round);
  let balance=0;for(const entry of [...s.ledger].reverse()){balance+=entry.amount;assert.equal(entry.balance_after,balance);}
  if(round%20===0){await stop();await start();assert.equal((await request('/bootstrap')).wallet.available,s.wallet.available);}
  if(round%30===0){const r=await fetch(base+'/api/export/backup',{headers:{Cookie:cookie}});assert.equal(r.status,200);const archive=join(folder,'backup.tar.gz');await writeFile(archive,Buffer.from(await r.arrayBuffer()));const target=join(folder,'restored-'+round);const restored=await restoreBackup(archive,target);assert.ok(restored.files>1);await rm(target,{recursive:true,force:true});}
  await record({event:'round',round,available:s.wallet.available,ledgerEntries:s.ledger.length});
  if(round%10===0)console.log(`Round ${round}: ledger ${s.ledger.length}, balance ${s.wallet.available}, all invariants passed`);
  await pause(Math.max(0,Math.min(20000,until-Date.now())));
 }
 latencies.sort((a,b)=>a-b);const result={event:'complete',round,requests:latencies.length,p50Ms:latencies[Math.floor(latencies.length*.5)],p95Ms:latencies[Math.floor(latencies.length*.95)],maxMs:latencies.at(-1)};await record(result);console.log(JSON.stringify(result));
}catch(e){await record({event:'failure',round,error:e.stack});console.error(e);process.exitCode=1;}
finally{await stop();const target=resolve(folder);if(!target.startsWith(work+sep))throw new Error('Unsafe soak cleanup');await rm(target,{recursive:true,force:true});}
