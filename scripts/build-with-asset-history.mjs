import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {buildKeepingAssetHistory} from './asset-history.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
try{await buildKeepingAssetHistory(resolve(root,'dist/client/assets'),()=>new Promise((accept,reject)=>{
 const child=spawn(process.platform==='win32'?'npm.cmd':'npm',['run','build:bundle'],{cwd:root,stdio:'inherit',shell:process.platform==='win32',windowsHide:true});
 child.on('error',reject);child.on('exit',(code,signal)=>code===0?accept():reject(new Error('Build failed: '+(signal||code))));
}));}catch(error){console.error(error.message);process.exitCode=1;}
