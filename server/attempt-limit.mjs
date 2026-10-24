import {AppError} from './store.mjs';
import {clientMetadata} from './client-metadata.mjs';
export const attemptAddress=req=>clientMetadata(req).ip||String(req.socket?.remoteAddress||'local').slice(0,80);
export function createAttemptLimit({max,windowMs=60000,capacity=10000,clock=Date.now,message='尝试过于频繁，请 1 分钟后重试'}){
 const entries=new Map();let sweepAt=0;
 function sweep(now){for(const [key,value] of entries)if(value.until<=now)entries.delete(key);sweepAt=now+Math.min(windowMs,30000);}
 function check(key){
  const now=clock();if(now>=sweepAt)sweep(now);
  const old=entries.get(key);
  if(old?.until<=now)entries.delete(key);
  const current=entries.get(key);
  if(current&&current.count>=max)throw new AppError(message,429);
  if(!current&&entries.size>=capacity){sweep(now);if(entries.size>=capacity)throw new AppError(message,429);}
  return current;
 }
 return {
  check,
  hit(key){const old=check(key),entry=old||{count:0,until:clock()+windowMs};entry.count++;entries.set(key,entry);},
  reset(key){entries.delete(key);},
 };
}
