import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../server/store.mjs';
test('commission configuration rejects stale versions without changing current rate',()=>{
 const store=createStore(':memory:');try{
  const original=store.commissionSettings();assert.equal(original.revision,0);
  const first=store.setCommissionRate('5',original.revision);assert.equal(first.revision,1);
  assert.throws(()=>store.setCommissionRate('20',original.revision),e=>e.status===409);
  assert.equal(store.commissionSettings().rate_bps,500);
  const next=store.setCommissionRate('7.25',first.revision);assert.equal(next.revision,2);assert.equal(next.rate_bps,725);
  for(const invalid of [-1,null,'2',1.1])assert.throws(()=>store.setCommissionRate('10',invalid),e=>e.status===400);
  assert.equal(store.commissionSettings().revision,2);
 }finally{store.close();}
});
