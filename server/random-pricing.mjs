import {randomInt} from 'node:crypto';
import {AppError} from './store.mjs';
export function parseRandomPricing(value){
 if(value===null||value===undefined)return null;
 if(typeof value!=='object'||Array.isArray(value))throw new AppError('随机金额区间无效');
 const parse=v=>{if(!/^\d+(\.\d{1,2})?$/.test(String(v)))throw new AppError('随机金额最多两位小数');const n=Math.round(Number(v)*100);if(!Number.isSafeInteger(n)||n<1||n>100000000)throw new AppError('随机金额需在0.01–1000000 USD之间');return n;};
 const minAmount=parse(value.minAmount),maxAmount=parse(value.maxAmount);
 if(minAmount>maxAmount)throw new AppError('最低随机金额不能大于最高金额');
 return {minAmount,maxAmount};
}
export function randomPricedAmount(policy){return randomInt(policy?.minAmount??20000,(policy?.maxAmount??50000)+1);}
