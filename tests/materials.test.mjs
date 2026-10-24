import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRange} from '../server/materials.mjs';
import {createStore} from './fixtures/store.mjs';

test('media ranges cover open, bounded and suffix requests',()=>{
 assert.equal(parseRange(undefined,100),null);
 assert.deepEqual(parseRange('bytes=0-9',100),{start:0,end:9});
 assert.deepEqual(parseRange('bytes=90-',100),{start:90,end:99});
 assert.deepEqual(parseRange('bytes=-10',100),{start:90,end:99});
 assert.deepEqual(parseRange('bytes=90-999',100),{start:90,end:99});
 assert.deepEqual(parseRange('bytes=-999',100),{start:0,end:99});
 for(const value of ['bytes=100-','bytes=9-1','bytes=-0','bytes=-','bytes=0-1,3-4','foo','bytes=99999999999999999999-']) assert.throws(()=>parseRange(value,100),e=>e.status===416);
});
test('archived materials remain recoverable and disappear from task details',()=>{
 const s=createStore(':memory:');try{
  const m=s.addMaterial('secret-wife',{name:'test.txt',mime:'text/plain',size:20,path:'/materials/test.txt',kind:'document'});
  assert.equal(s.getTask('secret-wife').materials.length,1);
  s.archiveMaterial(m.id);s.archiveMaterial(m.id);
  assert.equal(s.getTask('secret-wife').materials.length,0);
  assert.equal(s.listMaterials('secret-wife',true).length,1);
  assert.equal(s.materialPath('/materials/test.txt').id,m.id);
  s.restoreMaterial(m.id);s.restoreMaterial(m.id);
  assert.equal(s.getTask('secret-wife').materials.length,1);
 }finally{s.close();}
});
