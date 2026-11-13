import {gzip} from 'node:zlib';
function acceptsGzip(header){const entries=String(header||'').split(',').map(value=>{const [name,...params]=value.trim().toLowerCase().split(';');const quality=params.find(v=>v.trim().startsWith('q='));return {name,q:quality===undefined?1:Number(quality.trim().slice(2))};});const choice=entries.find(v=>v.name==='gzip')||entries.find(v=>v.name==='*');return !!choice&&choice.q>0&&choice.q<=1;}
export function sendJson(res,code,body){
 const raw=Buffer.from(JSON.stringify(body)),headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Accept-Encoding'};
 const finish=(bytes,compressed)=>{if(res.destroyed)return;res.writeHead(code,{...headers,...(Number.isFinite(res.requestStartedAt)?{'Server-Timing':'app;dur='+Math.max(0,performance.now()-res.requestStartedAt).toFixed(2)}:{}),...(compressed?{'Content-Encoding':'gzip'}:{}),'Content-Length':bytes.length});res.end(bytes);};
 if(raw.length>=1024&&acceptsGzip(res.req?.headers['accept-encoding'])){gzip(raw,{level:1},(error,bytes)=>finish(error?raw:bytes,!error));}else finish(raw,false);
}
