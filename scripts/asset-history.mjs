import {readdir,readFile,mkdir,writeFile,lstat} from 'node:fs/promises';
import {join,relative,resolve,sep} from 'node:path';
const versioned=/^.+-[A-Za-z0-9_-]{8,}\.(?:js|css)(?:\.(?:br|gz))?$/;
// Keep only immutable public code assets, never HTML, runtime data or symlinks.
export async function captureAssetHistory(directory){
 const root=resolve(directory),files=new Map();
 async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isSymbolicLink())continue;if(entry.isDirectory())await walk(path);else if(entry.isFile()&&versioned.test(entry.name))files.set(relative(root,path),await readFile(path));}}
 try{await walk(root);}catch(error){if(error.code!=='ENOENT')throw error;}
 return files;
}
export async function restoreAssetHistory(directory,files){
 const root=resolve(directory);let restored=0;
 for(const [name,bytes] of files){const path=resolve(root,name);if(!path.startsWith(root+sep))throw new Error('Invalid asset history path');
  // A new build owns its current assets. Never replace an existing file.
  const existing=await lstat(path).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
  if(existing){if(!existing.isFile()||!bytes.equals(await readFile(path)))throw new Error('Immutable asset changed: '+name);continue;}
  await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path,bytes,{flag:'wx'});restored++;
 }
 return restored;
}
export async function buildKeepingAssetHistory(directory,build){
 const files=await captureAssetHistory(directory);
 try{return await build();}finally{const restored=await restoreAssetHistory(directory,files);console.log('Retained '+files.size+' prior immutable assets ('+restored+' restored).');}
}
