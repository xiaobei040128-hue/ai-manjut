import {samplePercentAmount} from './decimal-dispatch-pricing.mjs';
import {randomInt} from 'node:crypto';
import {AppError} from './store.mjs';

export function parseBalancePricing(value){
 if(value===null||value===undefined)return null;
 if(typeof value!=='object'||Array.isArray(value))throw new AppError('余额比例设置无效');
 const parse=v=>{if(!/^\d+(\.\d{1,2})?$/.test(String(v)))throw new AppError('派单比例最多两位小数');const n=Number(v);if(n<0.01||n>100)throw new AppError('派单比例需在0.01%–100%之间');return n;};
 const minPercent=parse(value.minPercent),maxPercent=parse(value.maxPercent);
 if(minPercent>maxPercent)throw new AppError('最低派单比例不能大于最高比例');
 return {minPercent,maxPercent};
}

export function balancePricedAmount(available,policy){return samplePercentAmount(available,parseBalancePricing(policy)).amount;}
