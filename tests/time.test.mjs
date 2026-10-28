import test from 'node:test';
import assert from 'node:assert/strict';
import {shanghaiDay} from '../server/time.mjs';
test('customer dispatch dates use the Shanghai midnight boundary independent of the host timezone',()=>{
 assert.equal(shanghaiDay(new Date('2026-10-24T15:59:59.999Z')),'2026-10-24');
 assert.equal(shanghaiDay(new Date('2026-10-24T16:00:00.000Z')),'2026-10-25');
 assert.equal(shanghaiDay(new Date('2026-12-31T16:00:00.000Z')),'2027-01-01');
});
