import {readdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {gzipSync,brotliCompressSync,constants} from 'node:zlib';
import {createHash} from 'node:crypto';
const root='dist/client';
const html=await readFile(join(root,'index.html'),'utf8');
const digest=createHash('sha256');
// Include worker logic before replacing its cache name, so cache fixes receive a new build ID.
digest.update(await readFile('public/sw.js'));
async function collect(dir){const result=[];for(const e of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const p=join(dir,e.name);if(e.isDirectory())result.push(...await collect(p));else if(!/\.(?:br|gz)$/.test(e.name)&&!['sw.js','release-meta.json'].includes(e.name))result.push(p);}return result;}
for(const path of await collect(root)){digest.update(path.replaceAll('\\','/'));digest.update(await readFile(path));}
const version=digest.digest('hex').slice(0,12);
await writeFile(join(root,'release-meta.json'),JSON.stringify({brand:'AI CREATOR',buildId:version,builtAt:new Date().toISOString()},null,2)+'\n');
const swPath=join(root,'sw.js');let sw=await readFile(swPath,'utf8');sw=sw.replace(/const CACHE='[^']+';/,`const CACHE='drama-studio-${version}';`);await writeFile(swPath,sw);
let count=0,rawTotal=0,brTotal=0;
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await walk(path);else if(/\.(js|css|html|webmanifest|json|svg)$/.test(entry.name)){const bytes=await readFile(path);const gzip=gzipSync(bytes,{level:9}),br=brotliCompressSync(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:6}});if(gzip.length<bytes.length)await writeFile(path+'.gz',gzip);if(br.length<bytes.length)await writeFile(path+'.br',br);count++;rawTotal+=bytes.length;brTotal+=Math.min(bytes.length,br.length);}}}
await walk(root);console.log(`Prepared ${count} text assets: ${Math.round(rawTotal/1024)} KB raw / ${Math.round(brTotal/1024)} KB Brotli; shell ${version}`);
