export type ReadingDay={count:number;done:number;revealed:boolean;order:string[]};
export function restoreReadingDay(saved:unknown,ids:string[],random=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296):ReadingDay{
 const v=saved as Partial<ReadingDay>|null;
 const validProgress=v&&Number.isInteger(v.done)&&v.done!>=0&&Number.isInteger(v.count)&&v.count!>=12&&v.count!<=Math.max(20,ids.length)&&v.done!<=v.count!&&typeof v.revealed==='boolean';
 const validOrder=Array.isArray(v?.order)&&v.order.length===ids.length&&new Set(v.order).size===ids.length&&v.order.every(id=>ids.includes(id));
 const order=validOrder?[...v!.order!]:[...ids];
 if(!validOrder)for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 const done=validProgress?Math.min(v!.done!,ids.length):0;
 return {count:ids.length,done,revealed:done<ids.length&&!!(validProgress&&v!.revealed),order};
}
