import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const text=readFileSync(new URL('../src/studio/task-clipboard.ts',import.meta.url),'utf8');
const {copyTaskCode}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(text)).toString('base64'));

test('task copy writes the exact copyright code once and resolves on success',async()=>{
 const calls=[];await copyTaskCode('CR-EXAMPLE',{write:async code=>{calls.push(code);}});assert.deepEqual(calls,['CR-EXAMPLE']);
});
test('task copy reports denied or unavailable clipboard access',async()=>{
 const denied=new Error('Permission denied');await assert.rejects(copyTaskCode('CR-EXAMPLE',{write:()=>Promise.reject(denied)}),error=>error===denied);
 await assert.rejects(copyTaskCode('CR-EXAMPLE',{write:()=>{throw new TypeError('Unavailable');}}),/Unavailable/);
});
test('a stalled clipboard request times out and a late rejection stays handled',async()=>{
 let rejectLate;const pending=new Promise((_,reject)=>{rejectLate=reject;});
 await assert.rejects(copyTaskCode('CR-EXAMPLE',{timeoutMs:15,write:()=>pending}),/timed out/);
 rejectLate(new Error('Late permission denial'));await new Promise(resolve=>setImmediate(resolve));
});
