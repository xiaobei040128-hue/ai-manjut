import {readFileSync} from 'node:fs';
const mapping=JSON.parse(readFileSync(new URL('../shared/task-cover-images.json',import.meta.url),'utf8')),previews=new Map();
// Small, public, versioned covers are read once; no filesystem work during draws.
for(const [source,path] of Object.entries(mapping)){
 if(!/^\/assets\/cover-[a-z0-9-]+-thumbnail-[a-f0-9]{12}\.webp$/.test(path))continue;
 try{const bytes=readFileSync(new URL('../public'+path,import.meta.url));if(bytes.length>60000||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')continue;previews.set(source,Object.freeze({source,dataUri:'data:image/webp;base64,'+bytes.toString('base64')}));}catch{}
}
export function taskCoverPreview(source,knownSource=''){return typeof source==='string'&&source!==knownSource?previews.get(source)||null:null;}
