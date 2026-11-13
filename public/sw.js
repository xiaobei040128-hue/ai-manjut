const CACHE='drama-studio-performance-20261102';
const APP='/?view=app';
// Local caching is optional. A storage error must never replace a healthy network response.
async function openCache(){try{return await caches.open(CACHE);}catch{return null;}}
async function cachedResponse(request){try{return await (await openCache())?.match(request);}catch{return undefined;}}
async function remember(request,response){try{await (await openCache())?.put(request,response);}catch{/* Browsing remains available when cache writes fail. */}}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const response=await fetch(APP,{cache:'no-cache'});if(!response.ok)throw new Error('App shell unavailable');
 const html=await response.clone().text();await remember(APP,response);
 const assets=[...html.matchAll(/(?:src|href)="([^"\s]+\.(?:js|css))"/g)].map(m=>m[1]).filter(path=>new URL(path,self.location.origin).origin===self.location.origin);
 try{await (await openCache())?.addAll(['/manifest.webmanifest',"/icons/ai-creator-64-a2503d172634.png",...assets]);}catch{/* Offline assets can be cached on later requests. */}
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 try{for(const name of await caches.keys())if(name.startsWith('drama-studio-')&&name!==CACHE)await caches.delete(name);}catch{/* Storage may be unavailable. */}
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||['/admin','/admin/','/admin.html'].includes(url.pathname)||url.pathname.startsWith('/api/')||url.pathname.startsWith('/uploads/')||url.pathname.startsWith('/materials/')||url.pathname.startsWith('/@')||url.pathname.startsWith('/src/')||url.pathname.startsWith('/node_modules/'))return;
 if(request.mode==='navigate'){
  event.respondWith((async()=>{
   let response;try{response=await fetch(request,{cache:'no-cache'});}catch{return await cachedResponse(APP)||new Response('平台暂时无法连接，请检查网络后重新连接。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}
   if(response.ok)event.waitUntil(remember(APP,response.clone()));
   return response;
  })());return;
 }
 if(['script','style','font','image'].includes(request.destination)||url.pathname.endsWith('.webmanifest'))event.respondWith((async()=>{
  const cached=await cachedResponse(request),immutable=/\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/.test(url.pathname);
  const versionedIcon=/^\/icons\/ai-creator-(?:64|192|256|512)-[a-f0-9]{12}\.png$/.test(url.pathname);
  if((immutable||versionedIcon)&&cached)return cached;
  let response;try{response=await fetch(request,{cache:'no-cache'});}catch(error){if(cached)return cached;throw error;}
  if(response.ok)event.waitUntil(remember(request,response.clone()));
  return response;
 })());
});
