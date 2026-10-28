import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile('public/sw.js','utf8');
function worker(){
 const listeners=new Map(),stores=new Map(),origin='https://studio.example.invalid';let cacheWriteFailure=false,cacheOpenFailure=false;let network=async request=>new Response('network:'+String(request?.url||request));
 const key=request=>new URL(typeof request==='string'?request:request.url,origin).href;
 const caches={open:async name=>{if(cacheOpenFailure)throw Error('cache unavailable');if(!stores.has(name))stores.set(name,new Map());const values=stores.get(name);return {match:async request=>values.get(key(request))?.clone(),put:async(request,response)=>{if(cacheWriteFailure)throw Error('cache write failed');values.set(key(request),response.clone());},addAll:async()=>{}};},keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name),match:async request=>{for(const values of stores.values())if(values.has(key(request)))return values.get(key(request)).clone();}};
 vm.runInNewContext(source,{self:{location:{origin},addEventListener:(name,fn)=>listeners.set(name,fn),skipWaiting:async()=>{},clients:{claim:async()=>{}}},caches,fetch:(...args)=>network(...args),URL,Response});
 return {stores,caches,setCacheFailure:({write=false,open=false}={})=>{cacheWriteFailure=write;cacheOpenFailure=open;},setNetwork:fn=>{network=fn;},async event(name,input={}){let response;const work=[];listeners.get(name)({...input,waitUntil:promise=>work.push(promise),respondWith:promise=>{response=promise;}});const result=response?await response:undefined;await Promise.all(work);return result;},request(path,props={}){return {url:origin+path,method:'GET',mode:'cors',destination:'',...props};}};
}
test('service worker never intercepts customer APIs, evidence, materials or administration',async()=>{
 const w=worker();w.setNetwork(()=>{throw Error('Sensitive traffic must bypass worker');});
 for(const path of ['/api/finance','/api/bootstrap','/api/notifications','/api/admin/finance/identity/id/photos/front','/uploads/123.png','/materials/123.mp4','/admin','/admin/','/admin.html'])assert.equal(await w.event('fetch',{request:w.request(path,{destination:'image',mode:'navigate'})}),undefined,path);
 assert.equal(await w.event('fetch',{request:w.request('/assets/app.js',{method:'POST',destination:'script'})}),undefined);
 assert.equal(await w.event('fetch',{request:{url:'https://foreign.example.invalid/image.png',method:'GET',destination:'image'}}),undefined);
 assert.equal(w.stores.size,0);
});
test('offline navigation falls back to the application shell while financial records stay uncached',async()=>{
 const w=worker();w.setNetwork(async()=>new Response('<html>current application shell</html>',{headers:{'Content-Type':'text/html'}}));
 await w.event('install');w.setNetwork(async()=>{throw Error('offline');});
 const shell=await w.event('fetch',{request:w.request('/?view=app&page=wallet',{mode:'navigate'})});assert.equal(shell.status,200);assert.match(await shell.text(),/current application shell/);
 assert.equal(await w.event('fetch',{request:w.request('/api/finance')}),undefined);
 for(const entries of w.stores.values())for(const path of entries.keys())assert.ok(!path.includes('/api/')&&!path.includes('/uploads/'));
 const empty=worker();empty.setNetwork(async()=>{throw Error('offline');});const unavailable=await empty.event('fetch',{request:empty.request('/',{mode:'navigate'})});assert.equal(unavailable.status,503);assert.match(await unavailable.text(),/重新连接/);
});
test('service worker activation removes previous application caches',async()=>{
 const w=worker();await w.caches.open('drama-studio-obsolete');await w.caches.open('another-application');await w.event('install');await w.event('activate');assert.ok(!w.stores.has('drama-studio-obsolete'));assert.ok(w.stores.has('another-application'));assert.equal(w.stores.size,2);
});

test('unhashed images refresh immediately online and fall back to their latest cached copy offline',async()=>{const w=worker();await w.event('install');let value='image-v1',calls=0;w.setNetwork(async()=>{calls++;return new Response(value);});const request=w.request('/icons/ai-creator-approved.png',{destination:'image'});assert.equal(await(await w.event('fetch',{request})).text(),'image-v1');value='image-v2';assert.equal(await(await w.event('fetch',{request})).text(),'image-v2');assert.equal(calls,2);w.setNetwork(async()=>{throw Error('offline');});assert.equal(await(await w.event('fetch',{request})).text(),'image-v2');});
test('offline shell never falls back to a different obsolete application cache',async()=>{const w=worker(),old=await w.caches.open('drama-studio-obsolete');await old.put('/?view=app',new Response('obsolete shell'));w.setNetwork(async()=>new Response('current shell'));await w.event('install');w.setNetwork(async()=>{throw Error('offline');});assert.equal(await(await w.event('fetch',{request:w.request('/?view=app',{mode:'navigate'})})).text(),'current shell');});

test('successful online navigation and assets survive cache write or storage failures',async()=>{
 for(const failure of [{write:true},{open:true}]){const w=worker();w.setNetwork(async()=>new Response('live online response'));w.setCacheFailure(failure);for(const request of [w.request('/?view=app&page=wallet',{mode:'navigate'}),w.request('/stories/current.webp',{destination:'image'})]){const response=await w.event('fetch',{request});assert.equal(response.status,200);assert.equal(await response.text(),'live online response');}}
});
