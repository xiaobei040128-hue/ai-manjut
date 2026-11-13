import {randomInt} from 'node:crypto';
import {AppError} from './store.mjs';
export function samplePercentAmount(available,p){
 if(!Number.isSafeInteger(available)||available<0)throw new AppError('账户可用余额无效',409);
 const low=Math.round(p.minPercent*100),high=Math.round(p.maxPercent*100);
 if(!Number.isSafeInteger(low)||!Number.isSafeInteger(high)||low<1||low>high||high>100000)throw new AppError('派单比例无效');
 const percentBps=randomInt(low,high+1),amount=Number((BigInt(available)*BigInt(percentBps)+5000n)/10000n);
 if(amount<1)throw new AppError('可用余额不足，暂无法按比例派单',409);
 if(!Number.isSafeInteger(amount)||amount>100000000)throw new AppError('订单金额超出支持范围',409);
 return {amount,percent:percentBps/100};
}
export function sampleCommissionRate(premium,p,ordinary={minPercent:0.56,maxPercent:0.68}){
 const ordinaryRateBps=randomInt(Math.round(ordinary.minPercent*100),Math.round(ordinary.maxPercent*100)+1);
 const multiplier=premium?randomInt(Math.round(p.minMultiplier*100),Math.round(p.maxMultiplier*100)+1)/100:1;
 return {rateBps:Math.round(ordinaryRateBps*multiplier),ordinaryRateBps,multiplier};
}
