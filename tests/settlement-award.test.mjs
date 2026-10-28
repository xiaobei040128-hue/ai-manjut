import test from 'node:test';import assert from 'node:assert/strict';import {premiumSettlement} from '../src/studio/settlement-award.ts';
test('settlement celebration follows only this completed premium order, never ordinary or historical orders',()=>{
const high={id:'premium-old',status:'completed',task:{premium:1,stage:3}},normal={id:'ordinary-current',status:'completed',task:{premium:0,stage:3}};
assert.equal(premiumSettlement(high.id,{first:true,assignment:high}),high);
assert.equal(premiumSettlement(normal.id,{first:true,assignment:normal}),null);
assert.equal(premiumSettlement(normal.id,{first:true,assignment:high}),null);
assert.equal(premiumSettlement(high.id,{first:false,assignment:high}),null);
assert.equal(premiumSettlement(high.id,{first:true,assignment:{...high,status:'active'}}),null);
assert.equal(premiumSettlement(high.id,{first:true,assignment:{...high,task:{premium:1,stage:2}}}),null);
});
