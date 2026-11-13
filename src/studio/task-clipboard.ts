// Browser clipboard permission can remain pending indefinitely in embedded or
// background tabs. Let the existing manual-copy path release the task button.
export async function copyTaskCode(code:string,{timeoutMs=1200,write=(text:string)=>navigator.clipboard.writeText(text)}:{timeoutMs?:number;write?:(text:string)=>Promise<void>}={}){
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const pending=write(code);
  await Promise.race([pending,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Clipboard request timed out')),timeoutMs);})]);
 }finally{if(timer!==undefined)clearTimeout(timer);}
}
