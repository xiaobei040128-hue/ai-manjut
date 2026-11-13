import {readFile,stat} from 'node:fs/promises';
import {join,resolve,relative,extname} from 'node:path';
import {AppError} from './store.mjs';

export function acceptedEncoding(value){
 const map=new Map(String(value||'').split(',').map(item=>{const [name,...params]=item.trim().split(';');const weight=params.find(p=>p.trim().startsWith('q='));return [name.toLowerCase(),weight?Number(weight.trim().slice(2)):1];}));
 const weight=name=>map.get(name)??map.get('*')??0;
 return ['br','gzip'].filter(name=>Number.isFinite(weight(name))&&weight(name)>0).sort((a,b)=>weight(b)-weight(a));
}
export async function serveStatic(req,res,url,base,types){
 if(!['GET','HEAD'].includes(req.method))throw new AppError('不支持此请求方式',405);
 let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{throw new AppError('路径无效',400);}
 const target=["/admin","/admin/"].includes(pathname)?join(base,'admin.html'):resolve(base,'.'+pathname);if(relative(base,target).startsWith('..'))throw new AppError('路径无效',400);
 let file=target,info=await stat(file).catch(()=>null);
 if(!info?.isFile()){
  if(pathname==='/'||(!extname(pathname)&&String(req.headers.accept||'').includes('text/html'))){file=join(base,'index.html');info=await stat(file);}
  else throw new AppError('文件不存在',404);
 }
 const extension=extname(file);let encoding=null,disk=file;
 for(const preferred of acceptedEncoding(req.headers['accept-encoding'])){const candidate=await stat(file+(preferred==='br'?'.br':'.gz')).catch(()=>null);if(candidate?.isFile()){encoding=preferred;disk=file+(preferred==='br'?'.br':'.gz');info=candidate;break;}}
 const tag=`W/"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}-${encoding||'raw'}"`;
 const immutable=/[\\/]assets[\\/].+-[a-zA-Z0-9_-]{8,}\.[a-z0-9]+$/.test(file)||/^\/audio\/task-(?:standard|premium|complete)-v[1-9][0-9]*\.wav$/.test(pathname);
 const headers={'Content-Type':types[extension]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':immutable?'public, max-age=31536000, immutable':'no-cache','Vary':'Accept-Encoding','ETag':tag};
 if(encoding)headers['Content-Encoding']=encoding;
 if(String(req.headers['if-none-match']||'').split(',').map(x=>x.trim()).some(x=>x===tag||x==='*')){res.writeHead(304,headers);return res.end();}
 headers['Content-Length']=info.size;res.writeHead(200,headers);if(req.method==='HEAD')return res.end();res.end(await readFile(disk));
}
