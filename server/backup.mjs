import {DatabaseSync,backup} from 'node:sqlite';
import {createReadStream} from 'node:fs';
import {mkdir,mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createGzip} from 'node:zlib';

const safeMedia=/^(finance\.key|uploads\/[a-f0-9-]+\.(png|jpg|webp|gif)|materials\/[a-f0-9-]+\.(mp4|webm|txt|srt))$/;
export function tarHeader(name,size){
 const b=Buffer.alloc(512);b.write(name,0,100,'utf8');
 const oct=(v,o,n)=>b.write(v.toString(8).padStart(n-1,'0')+'\0',o,n,'ascii');
 oct(0o600,100,8);oct(0,108,8);oct(0,116,8);oct(size,124,12);oct(Math.floor(Date.now()/1000),136,12);b.fill(32,148,156);b[156]=48;b.write('ustar\0',257,6,'ascii');b.write('00',263,2,'ascii');
 const sum=b.reduce((n,x)=>n+x,0);b.write(sum.toString(8).padStart(6,'0')+'\0 ',148,8,'ascii');return b;
}
async function digest(path){const h=createHash('sha256');for await(const part of createReadStream(path))h.update(part);return h.digest('hex');}
export async function streamBackup(dataDir,workDir,res){
 await mkdir(workDir,{recursive:true});const temp=await mkdtemp(join(workDir,'backup-'));
 try{
  const source=new DatabaseSync(join(dataDir,'workspace.sqlite'),{readOnly:true});
  const snapshot=join(temp,'workspace.sqlite');try{await backup(source,snapshot);}finally{source.close();}
  const snap=new DatabaseSync(snapshot,{readOnly:true});let rows;
  try{rows=snap.prepare('SELECT path FROM uploads UNION SELECT path FROM materials').all();}finally{snap.close();}
  const names=['workspace.sqlite',...rows.map(r=>r.path.slice(1))];
  if(await stat(join(dataDir,'finance.key')).catch(()=>null))names.push('finance.key');
  const files=[];
  for(const name of names){
   if(name!=='workspace.sqlite'&&!safeMedia.test(name))throw new Error('Unsafe stored media path');
   const disk=name==='workspace.sqlite'?snapshot:join(dataDir,name);const info=await stat(disk);
   files.push({name,disk,size:info.size,sha256:await digest(disk)});
  }
  const manifest=Buffer.from(JSON.stringify({format:'drama-studio-backup',version:1,createdAt:new Date().toISOString(),files:files.map(({disk,...file})=>file)},null,2));
  async function* entries(){
   yield tarHeader('manifest.json',manifest.length);yield manifest;yield Buffer.alloc((512-manifest.length%512)%512);
   for(const file of files){yield tarHeader(file.name,file.size);yield* createReadStream(file.disk);yield Buffer.alloc((512-file.size%512)%512);}
   yield Buffer.alloc(1024);
  }
  res.writeHead(200,{'Content-Type':'application/gzip','Content-Disposition':`attachment; filename="drama-studio-${new Date().toISOString().slice(0,10)}.tar.gz"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  await pipeline(Readable.from(entries()),createGzip({level:6}),res);
 }finally{
  const target=resolve(temp);if(target.startsWith(resolve(workDir)+sep))await rm(target,{recursive:true,force:true});
 }
}

export {safeMedia};
