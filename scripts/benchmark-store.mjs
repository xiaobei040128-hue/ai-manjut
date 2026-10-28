import {createStore} from '../server/store.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
const s=createStore(':memory:'),results=[];
try{
 s.db.exec("UPDATE tasks SET slots=10000 WHERE id='secret-wife'");
 for(let i=1;i<=250;i++){
  const a=s.claim('secret-wife');const uploads=Array.from({length:3},(_,j)=>s.addUpload(a.id,{name:j+'.png',mime:'image/png',size:100,path:`/uploads/benchmark-${i}-${j}.png`}));
  s.submit(a.id,{links:uploads.map((_,j)=>`https://example.com/benchmark/${i}/${j}`),uploadIds:uploads.map(u=>u.id)});s.review(a.id,{decision:'approve'});
  if([1,10,50,100,250].includes(i)){
   const samples=[];for(let n=0;n<20;n++){const began=performance.now();s.summary();samples.push(performance.now()-began);}samples.sort((a,b)=>a-b);
   results.push({assignments:i,p50Ms:samples[10],p95Ms:samples[19]});
  }
 }
 await mkdir('work',{recursive:true});const result={at:new Date().toISOString(),node:process.version,results};await writeFile(process.argv[2]||'work/benchmark-store.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{s.close();}
