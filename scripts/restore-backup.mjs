// Restores into a NEW directory only. Existing workspaces are never replaced.
import {createReadStream} from 'node:fs';
import {mkdir,open,rm,readFile} from 'node:fs/promises';
import {resolve,join,dirname,sep} from 'node:path';
import {createGunzip} from 'node:zlib';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {pathToFileURL} from 'node:url';
import {safeMedia} from '../server/backup.mjs';

export async function restoreBackup(archive,destination){
 const target=resolve(destination);await mkdir(dirname(target),{recursive:true});
 await mkdir(target); // Fails before reading if destination exists.
 let succeeded=false;
 try{
  const iterator=createReadStream(archive).pipe(createGunzip())[Symbol.asyncIterator]();
  let pending=Buffer.alloc(0),ended=false;
  async function exact(n){const out=Buffer.alloc(n);let offset=0;while(offset<n){if(!pending.length){const next=await iterator.next();if(next.done)throw new Error('Truncated backup');pending=next.value;}const count=Math.min(n-offset,pending.length);pending.copy(out,offset,0,count);pending=pending.subarray(count);offset+=count;}return out;}
  let manifest=null,total=0;const seen=new Map();
  while(!ended){
   const header=await exact(512);if(header.every(x=>x===0)){ended=true;break;}
   const checksum=parseInt(header.toString('ascii',148,156).replace(/\0.*$/,''),8);
   const actual=header.reduce((n,x,i)=>n+(i>=148&&i<156?32:x),0);if(checksum!==actual)throw new Error('Backup header checksum mismatch');
   const name=header.toString('utf8',0,100).replace(/\0.*$/,'');
   const size=parseInt(header.toString('ascii',124,136).replace(/\0.*$/,''),8);
   if(header[156]!==48||!Number.isSafeInteger(size)||size<0||size>256*1024*1024||seen.has(name))throw new Error('Invalid backup entry');
   if(name!=='manifest.json'&&name!=='workspace.sqlite'&&!safeMedia.test(name))throw new Error('Unsafe backup path');
   total+=size;if(total>10*1024*1024*1024)throw new Error('Backup exceeds 10 GB');
   if(name==='manifest.json'){
    if(manifest||seen.size||size>5*1024*1024)throw new Error('Invalid backup manifest');
    manifest=JSON.parse((await exact(size)).toString('utf8'));
    if(manifest.format!=='drama-studio-backup'||manifest.version!==1||!Array.isArray(manifest.files))throw new Error('Unsupported backup format');
    seen.set(name,{});
   }else{
    if(!manifest)throw new Error('Missing backup manifest');
    const expected=manifest.files.find(f=>f.name===name);if(!expected||expected.size!==size)throw new Error('Unexpected backup entry');
    const disk=resolve(target,name);if(!disk.startsWith(target+sep))throw new Error('Unsafe backup target');
    await mkdir(dirname(disk),{recursive:true});const file=await open(disk,'wx');const hash=createHash('sha256');
    try{let left=size;while(left){const block=await exact(Math.min(left,65536));hash.update(block);await file.writeFile(block);left-=block.length;}}finally{await file.close();}
    if(hash.digest('hex')!==expected.sha256)throw new Error('Backup file checksum mismatch: '+name);seen.set(name,expected);
   }
   await exact((512-size%512)%512);
  }
  // Drain the gzip stream to verify its checksum and reject truncated archives.
  const end=await exact(512);if(end.some(x=>x!==0)||pending.some(x=>x!==0))throw new Error('Unexpected trailing backup data');for await(const part of { [Symbol.asyncIterator]:()=>iterator }){if(part.some(x=>x!==0))throw new Error('Unexpected trailing backup data');}
  if(!manifest||manifest.files.length!==seen.size-1||!seen.has('workspace.sqlite'))throw new Error('Incomplete backup');
  const db=new DatabaseSync(join(target,'workspace.sqlite'),{readOnly:true});try{
   if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Database integrity check failed');
   if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Database relations are invalid');
   const hasFinance=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='identities'").get();
   const encrypted=hasFinance?db.prepare('SELECT (SELECT COUNT(*) FROM identities)+(SELECT COUNT(*) FROM bank_cards) AS n').get().n:0;
   if(encrypted&&!seen.has('finance.key'))throw new Error('Missing finance encryption key');
   if(seen.has('finance.key')&&(await readFile(join(target,'finance.key'))).length!==32)throw new Error('Invalid finance encryption key');
  }finally{db.close();}
  succeeded=true;return {destination:target,files:manifest.files.length,createdAt:manifest.createdAt};
 }finally{if(!succeeded)await rm(target,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [archive,destination]=process.argv.slice(2);
 if(!archive||!destination){console.error('Usage: node scripts/restore-backup.mjs <backup.tar.gz> <NEW-data-directory>');process.exitCode=1;}
 else try{console.log(JSON.stringify(await restoreBackup(archive,destination),null,2));}catch(e){console.error('Restore failed: '+e.message);process.exitCode=1;}
}
