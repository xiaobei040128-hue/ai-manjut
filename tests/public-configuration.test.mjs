import http from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
const work=resolve('work'),port=4194,base='http://127.0.0.1:'+port,publicHost='studio.example.invalid',setupToken='isolated-public-setup-token-for-qa';
async function launch(directory,overrides={}){
 const child=spawn(process.execPath,['server/index.mjs','--production','--port',String(port)],{cwd:process.cwd(),env:{...process.env,DRAMA_DATA_DIR:directory,DRAMA_ALLOWED_HOSTS:publicHost,DRAMA_COOKIE_SECURE:'1',DRAMA_SETUP_TOKEN:setupToken,...overrides},stdio:['ignore','pipe','pipe'],windowsHide:true});
 let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);
 const began=Date.now();while(child.exitCode===null&&!output.includes('Drama Studio 2.0:')){if(Date.now()-began>15000){child.kill();throw Error('Public configuration startup timeout');}await new Promise(r=>setTimeout(r,20));}
 return {child,output};
}
async function stop(child){if(child?.exitCode===null){const exited=once(child,'exit');child.kill();await exited;}}
async function call(path,{method='GET',data,host=publicHost,cookie='',origin}={}){
 return new Promise((resolve,reject)=>{
  const payload=data===undefined?undefined:JSON.stringify(data);
  const req=http.request(base+'/api'+path,{method,headers:{Host:host,Cookie:cookie,...(origin?{Origin:origin}:{}),...(method==='GET'?{}:{'Content-Type':'application/json','X-Workspace-Request':'1'}),...(payload?{'Content-Length':Buffer.byteLength(payload)}:{})}},res=>{
   const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const bytes=Buffer.concat(chunks),headers=new Headers();for(const [name,value] of Object.entries(res.headers))for(const item of Array.isArray(value)?value:[value])if(item!==undefined)headers.append(name,item);resolve(new Response(bytes.length?bytes:null,{status:res.statusCode,headers}));});
  });req.on('error',reject);req.end(payload);
 });
}
test('public deployment configuration requires secure cookies, setup token, host and request origin checks',async()=>{
 await mkdir(work,{recursive:true});const directory=await mkdtemp(join(work,'public-config-'));let running;
 try{
  const insecure=await launch(directory,{DRAMA_COOKIE_SECURE:'0'});assert.notEqual(insecure.child.exitCode,0);assert.match(insecure.output,/Public hosts require/);
  const missing=await launch(directory,{DRAMA_SETUP_TOKEN:''});assert.notEqual(missing.child.exitCode,0);assert.match(missing.output,/Configure DRAMA_SETUP_TOKEN/);
  running=(await launch(directory)).child;assert.equal(running.exitCode,null);
  assert.equal((await call('/health',{host:'untrusted.example.invalid'})).status,403);
  assert.equal((await call('/admin/setup',{method:'POST',data:{username:'public-qa',password:'PublicConfigQA123!'}})).status,403);
  const setup=await call('/admin/setup',{method:'POST',data:{username:'public-qa',password:'PublicConfigQA123!',setupToken},origin:'https://'+publicHost});assert.equal(setup.status,200);assert.match(setup.headers.get('set-cookie'),/; Secure/);assert.match(setup.headers.get('set-cookie'),/HttpOnly/);
  const cookie=setup.headers.get('set-cookie').split(';')[0];
  const rejected=await call('/admin/commission-policy',{method:'POST',cookie,origin:'https://evil.example.invalid',data:{rate:'99'}});assert.equal(rejected.status,403);
  const allowed=await call('/admin/commission-policy',{method:'POST',cookie,origin:'https://'+publicHost,data:{rate:'5'}});assert.equal(allowed.status,200);
  const snapshot=await(await call('/admin/bootstrap',{cookie})).json();assert.equal(snapshot.system.mode,'https-proxy');assert.ok(!JSON.stringify(snapshot).includes(setupToken));
  const invite=await(await call('/admin/invitations',{method:'POST',cookie,data:{}})).json();
  const registered=await call('/auth/register',{method:'POST',data:{email:'public-config@example.invalid',password:'PublicConfigQA123!',inviteCode:invite.code},origin:'https://'+publicHost});assert.equal(registered.status,201);assert.match(registered.headers.get('set-cookie'),/; Secure/);
 }finally{await stop(running);const target=resolve(directory);if(!target.startsWith(work+sep))throw Error('Unsafe public configuration cleanup');await rm(target,{recursive:true,force:true});}
});
