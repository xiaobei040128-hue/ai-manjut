import {randomInt} from 'node:crypto';
import {AppError} from './store.mjs';

export function parseBalancePricing(value){
 if(value===null||value===undefined)return null;
 if(typeof value!=='object'||Array.isArray(value))throw new AppError('余额比例设置无效');
 const parse=v=>{if(!/^\d+(\.\d{1,2})?$/.test(String(v)))throw new AppError('派单比例最多两位小数');const n=Number(v);if(n<20||n>75)throw new AppError('派单比例需在20%–75%之间');return n;};
 const minPercent=parse(value.minPercent),maxPercent=parse(value.maxPercent);
 if(minPercent>maxPercent)throw new AppError('最低派单比例不能大于最高比例');
 return {minPercent,maxPercent};
}

export function balancePricedAmount(available,policy){
 if(!Number.isSafeInteger(available)||available<0)throw new AppError('账户可用余额无效',409);
 const p=parseBalancePricing(policy),basis=BigInt(available);
 const low=Number((basis*BigInt(Math.round(p.minPercent*100))+9999n)/10000n);
 const high=Number(basis*BigInt(Math.round(p.maxPercent*100))/10000n);
 const min=Math.max(1,low);
 if(high<min)throw new AppError('可用余额不足，暂无法按比例派单',409);
 if(high-min>=2**48-1)throw new AppError('余额超出随机派单支持范围',409);
 return randomInt(min,high+1);
}
