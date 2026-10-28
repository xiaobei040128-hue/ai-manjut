// Sustained, isolated real HTTP workflow test. No live data directory or external payment is used.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,mkdtemp,appendFile,writeFile,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {randomUUID} from 'node:crypto';

const args=process.argv.slice(2),value=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const duration=Number(value('--duration-ms','1200000')),interval=Number(value('--interval-ms','3000')),port=Number(value('--port','4183'));
if(!Number.isSafeInteger(duration)||duration<1000||duration>10800000||!Number.isSafeInteger(interval)||interval<0||interval>60000||!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid soak duration, interval or port');
const work=resolve('work');await mkdir(work,{recursive:true});const directory=await mkdtemp(join(work,'upgrade-soak-')),base='http://127.0.0.1:'+port;
const report=resolve(value('--report',join(work,'upgrade-soak-results.json'))),log=report.replace(/\.json$/,'.ndjson');await mkdir(resolve(report,'..'),{recursive:true});
let child,adminCookie='',round=0,requestCount=0,started=Date.now(),deadline=started+duration,failed=false;const latencies=[],users=[];let lastProgress=0;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function record(event){await appendFile(log,JSON.stringify({at:new Date().toISOString(),...event})+'\n');}
async function start(){
 child=spawn(process.execPath,['server/index.mjs','--production','--port',String(port)],{cwd:process.cwd(),env:{...process.env,DRAMA_DATA_DIR:directory,DRAMA_ALLOWED_HOSTS:'',DRAMA_SETUP_TOKEN:'',DRAMA_COOKIE_SECURE:'0'},stdio:['ignore','pipe','pipe'],windowsHide:true});
 let output='';await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Server startup timeout: '+output)),20000);const read=chunk=>{output=(output+chunk).slice(-10000);if(output.includes('Drama Studio 2.0:')){clearTimeout(timeout);resolve();}};child.stdout.on('data',read);child.stderr.on('data',read);child.once('error',e=>{clearTimeout(timeout);reject(e);});child.once('exit',code=>{clearTimeout(timeout);reject(Error('Server exited '+code+': '+output));});});
}
async function stop(){if(child&&child.exitCode===null){const finished=once(child,'exit');child.kill();await finished;}}
async function call(cookie,path,method='GET',input,expected){
 const begin=performance.now(),response=await fetch(base+'/api'+path,{method,headers:{Cookie:cookie,...(method==='GET'?{}:{'Content-Type':'application/json','X-Workspace-Request':'1'})},body:input===undefined?undefined:JSON.stringify(input),signal:AbortSignal.timeout(20000)});requestCount++;latencies.push(performance.now()-begin);const data=await response.json();if(expected===undefined?!response.ok:response.status!==expected)throw Error(method+' '+path+' returned '+response.status+': '+JSON.stringify(data));return {data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
const request=(...args)=>call(...args).then(r=>r.data),png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=';
await record({event:'start',durationMs:duration,intervalMs:interval,directory,port});
try{
 await start();adminCookie=(await call('','/admin/setup','POST',{username:'upgrade-soak-admin',password:'IsolatedSoakQA123!'})).cookie;
 await request(adminCookie,'/admin/commission-policy','POST',{rate:'5'});const invite=await request(adminCookie,'/admin/invitations','POST',{});
 for(const suffix of ['a','b']){const registered=await call('','/auth/register','POST',{email:'upgrade-soak-'+suffix+'@example.invalid',password:'IsolatedSoakQA123!',inviteCode:invite.code},201),user={id:registered.data.user.id,cookie:registered.cookie,expected:200100,earned:0};users.push(user);await request(adminCookie,'/admin/finance/account/'+user.id+'/adjust','POST',{direction:'credit',amount:'2000',note:'Isolated continuous workflow fixture',operationKey:randomUUID()});}
 const task=await request(adminCookie,'/tasks','POST',{title:'持续运行验证任务',description:'只用于隔离测试，上传作品并审核',stage:1,platform:'TikTok',language:'中文',genre:'持续验证',deposit:'100',posts:1,episodes:1,slots:10000,cover:'/art/hero-v2.webp'});
 while(Date.now()<deadline){round++;
  const taskQuote=await request(users[0].cookie,'/tasks/'+task.id),quote={amount:taskQuote.deposit,commission:taskQuote.commission,rateBps:taskQuote.commission_rate_bps};
  const assignments=await Promise.all(users.map(async user=>{const result=await call(user.cookie,'/assignments','POST',{taskId:task.id,expected:quote},201);return {user,assignment:result.data};}));
  assert.notEqual(assignments[0].assignment.id,assignments[1].assignment.id);
  for(const {user,assignment} of assignments){const duplicates=await Promise.all(Array.from({length:4},()=>call(user.cookie,'/assignments','POST',{taskId:task.id,expected:quote},201)));assert.ok(duplicates.every(r=>r.data.id===assignment.id));}
  if(round%5===0){await stop();await start();for(const {user,assignment} of assignments){const restored=await request(user.cookie,'/assignments/'+assignment.id);assert.equal(restored.task.commission,quote.commission);}}
  if(round%7===0)await request(adminCookie,'/admin/commission-policy','POST',{rate:round%14===0?'5':'7.5'});
  for(const {user,assignment} of assignments){
   const foreign=assignments.find(a=>a.user.id!==user.id).assignment;await call(user.cookie,'/assignments/'+foreign.id,'GET',undefined,404);
   if(round%4===0)await Promise.all(Array.from({length:3},()=>request(user.cookie,'/assignments/'+assignment.id+'/cancel','POST',{})));
   else{const uploaded=await call(user.cookie,'/assignments/'+assignment.id+'/uploads','POST',{name:'continuous-proof.png',data:png},201),payload={links:['https://example.invalid/soak/'+assignment.id],uploadIds:[uploaded.data.id],note:'Isolated sustained validation'};await request(user.cookie,'/assignments/'+assignment.id+'/draft','PATCH',payload);await request(user.cookie,'/assignments/'+assignment.id+'/submit','POST',payload);
    if(round%3===0){await request(adminCookie,'/assignments/'+assignment.id+'/review','POST',{decision:'changes',reason:'isolated revision verification'});await request(user.cookie,'/assignments/'+assignment.id+'/submit','POST',payload);}
    await Promise.all(Array.from({length:4},()=>request(adminCookie,'/assignments/'+assignment.id+'/review','POST',{decision:'approve'})));user.expected+=assignment.task.commission;user.earned+=assignment.task.commission;
   }
   const snapshot=await request(user.cookie,'/bootstrap');assert.equal(snapshot.wallet.available,user.expected);assert.equal(snapshot.wallet.held,0);assert.equal(snapshot.wallet.earned,user.earned);assert.equal(snapshot.assignments.length,round);assert.ok(snapshot.assignments.every(a=>a.owner_id===user.id));let balance=0;for(const entry of [...snapshot.ledger].reverse()){balance+=entry.amount;assert.equal(entry.balance_after,balance);}
   const notices=await request(user.cookie,'/notifications?limit=20');assert.ok(notices.notifications.every(n=>n.owner_id===user.id));
  }
  if(round%10===0){const integrity=await request(adminCookie,'/admin/integrity','POST',{});assert.equal(integrity.ok,true);}
  await record({event:'round',round,requests:requestCount,balances:users.map(u=>({id:u.id,available:u.expected,earned:u.earned}))});
  if(Date.now()-lastProgress>60000){console.log(JSON.stringify({round,requests:requestCount,elapsedSeconds:Math.round((Date.now()-started)/1000)}));lastProgress=Date.now();}
  await pause(Math.min(interval,Math.max(0,deadline-Date.now())));
 }
 latencies.sort((a,b)=>a-b);const result={status:'passed',startedAt:new Date(started).toISOString(),endedAt:new Date().toISOString(),elapsedSeconds:Math.round((Date.now()-started)/1000),rounds:round,requests:requestCount,restarts:Math.floor(round/5),p50Ms:Number(latencies[Math.floor(latencies.length*.5)].toFixed(2)),p95Ms:Number(latencies[Math.floor(latencies.length*.95)].toFixed(2)),maxMs:Number(latencies.at(-1).toFixed(2))};await writeFile(report,JSON.stringify(result,null,2));await record({event:'complete',...result});console.log(JSON.stringify(result));
}catch(error){failed=true;await record({event:'failure',round,error:String(error.stack||error)});await writeFile(report,JSON.stringify({status:'failed',round,error:String(error.stack||error)},null,2));console.error(error);process.exitCode=1;}
finally{await stop();if(!failed){const target=resolve(directory);if(!target.startsWith(work+sep))throw Error('Unsafe test cleanup');await rm(target,{recursive:true,force:true});}}
