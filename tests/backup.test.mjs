import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {gzipSync} from 'node:zlib';
import {tarHeader} from '../server/backup.mjs';
import {restoreBackup} from '../scripts/restore-backup.mjs';
const work=resolve('work');
test('backup restore rejects traversal, corrupt checksums and incomplete files without touching existing data',async()=>{
 await mkdir(work,{recursive:true});const root=await mkdtemp(join(work,'backup-security-'));
 try{
  const archive=join(root,'test.tar.gz'),existing=join(root,'existing');await mkdir(existing);await writeFile(join(existing,'keep.txt'),'keep');
  const manifest=Buffer.from(JSON.stringify({format:'drama-studio-backup',version:1,files:[]}));
  const entry=(name,data)=>[tarHeader(name,data.length),data,Buffer.alloc((512-data.length%512)%512)];
  const malicious=Buffer.concat([...entry('manifest.json',manifest),...entry('../escaped.txt',Buffer.from('unsafe')),Buffer.alloc(1024)]);
  await writeFile(archive,gzipSync(malicious));await assert.rejects(()=>restoreBackup(archive,join(root,'traversal')),/Unsafe backup path/);
  await assert.rejects(()=>stat(join(root,'escaped.txt')),e=>e.code==='ENOENT');
  await assert.rejects(()=>restoreBackup(archive,existing),e=>e.code==='EEXIST');assert.equal(await readFile(join(existing,'keep.txt'),'utf8'),'keep');
  const damaged=Buffer.from(malicious);damaged[0]^=1;await writeFile(archive,gzipSync(damaged));await assert.rejects(()=>restoreBackup(archive,join(root,'checksum')),/checksum/);
  await writeFile(archive,gzipSync(Buffer.concat(entry('manifest.json',manifest))));await assert.rejects(()=>restoreBackup(archive,join(root,'truncated')),/Truncated/);
 }finally{const target=resolve(root);if(!target.startsWith(work+sep))throw new Error('Unsafe test cleanup');await rm(target,{recursive:true,force:true});}
});
