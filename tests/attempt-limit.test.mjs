import test from 'node:test';
import assert from 'node:assert/strict';
import {createAttemptLimit} from '../server/attempt-limit.mjs';
test('attempt limits retain active bans under capacity pressure and release expired slots',()=>{
 let now=1000;const limit=createAttemptLimit({max:2,windowMs:100,capacity:2,clock:()=>now});
 limit.hit('customer-a');limit.hit('customer-a');limit.hit('customer-b');
 assert.throws(()=>limit.check('customer-a'),e=>e.status===429);
 // New sources cannot evict the blocked source to erase its history.
 for(let i=0;i<1000;i++)assert.throws(()=>limit.hit('new-source-'+i),e=>e.status===429);
 assert.throws(()=>limit.check('customer-a'),e=>e.status===429);
 limit.reset('customer-b');limit.hit('customer-c');limit.hit('customer-c');
 assert.throws(()=>limit.hit('customer-c'),e=>e.status===429);
 now=1100;limit.hit('customer-a');limit.hit('new-source');assert.doesNotThrow(()=>limit.check('customer-a'));
 assert.throws(()=>limit.hit('customer-b'),e=>e.status===429);
});
test('independent limiter instances do not share administrator and creator attempts',()=>{
 const admin=createAttemptLimit({max:1}),creator=createAttemptLimit({max:2});admin.hit('same-ip');assert.throws(()=>admin.check('same-ip'),e=>e.status===429);assert.doesNotThrow(()=>creator.hit('same-ip'));
});
