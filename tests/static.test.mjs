import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptedEncoding} from '../server/static.mjs';
test('compression negotiation respects preferences and explicit refusal',()=>{
 assert.deepEqual(acceptedEncoding('gzip, br'),['br','gzip']);
 assert.deepEqual(acceptedEncoding('br;q=0, gzip;q=1'),['gzip']);
 assert.deepEqual(acceptedEncoding('br;q=0.4,gzip;q=0.9'),['gzip','br']);
 assert.deepEqual(acceptedEncoding('*;q=0.5,br;q=0'),['gzip']);
 assert.deepEqual(acceptedEncoding('identity'),[]);
 assert.deepEqual(acceptedEncoding('gzip;q=bad'),[]);
});
