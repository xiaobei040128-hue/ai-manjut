import test from 'node:test';
import assert from 'node:assert/strict';
import {createDailyExample} from '../server/daily-example.mjs';
test('daily examples use 12–15 rows and independent cent-rounded price and commission ranges',()=>{
 for(const seed of [0,0.01,0.25,0.5,0.999999]){
  const items=createDailyExample(12345,()=>seed);assert.ok(items.length>=12&&items.length<=15);
  for(const [i,x] of items.entries()){assert.equal(x.sequence,i+1);assert.ok(x.portion>=1500&&x.portion<=7500);assert.ok(x.rate>=200&&x.rate<=500);assert.equal(x.amount,Math.round(12345*x.portion/10000));assert.equal(x.commission,Math.round(x.amount*x.rate/10000));}
 }
 assert.equal(createDailyExample(0,()=>0).length,12);assert.ok(createDailyExample(0).every(x=>x.amount===0&&x.commission===0));
 assert.equal(createDailyExample(10000,()=>0.999999).length,15);assert.throws(()=>createDailyExample(-1));assert.throws(()=>createDailyExample(1.01));
});
