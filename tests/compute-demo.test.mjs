import test from 'node:test';
import assert from 'node:assert/strict';
import {newCompute,computeChange,validCompute} from '../src/studio/computeCredits.ts';
test('creative demo credits are owner scoped, cannot overdraw, and retries charge only once',()=>{
 const a=newCompute('account-a'),b=newCompute('account-b');assert.equal(a.credits,80);assert.ok(validCompute(a,'account-a'));assert.ok(!validCompute(a,'account-b'));
 const paid=computeChange(a,'order-1','demo pack',100),used=computeChange(paid,'job-1','demo preview',-20);assert.equal(used.credits,160);assert.equal(computeChange(used,'job-1','retry',-20),used);assert.equal(b.credits,80);assert.throws(()=>computeChange(used,'bad','overspend',-999));assert.ok(!validCompute({...a,credits:999},'account-a'));assert.ok(validCompute(used,'account-a'));
});
