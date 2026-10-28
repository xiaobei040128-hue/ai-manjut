import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createStore} from '../server/store.mjs';

test('two customers with simultaneous live claims can reopen the same production database',async()=>{
 await mkdir(resolve('work'),{recursive:true});const dir=await mkdtemp(resolve('work/migration-live-')),file=join(dir,'workspace.sqlite');let store=createStore(file);
 try{
  store.setCommissionRate('7.5');
  const task=store.createTask({stage:1,title:'多人领取重启验证',description:'发布作品',platform:'TikTok',language:'中文',genre:'剧情',deposit:'100',posts:1,episodes:1,slots:10,cover:'/art/hero-v2.webp'});
  const quote={amount:task.deposit,commission:task.commission,rateBps:task.commission_rate_bps};
  const before=[];
  for(const id of ['migration-owner-a','migration-owner-b']){
   store.db.prepare('INSERT INTO creator_profiles VALUES(?,?,?,?,?)').run(id,id,'','',new Date().toISOString());
   store.db.prepare('INSERT INTO ledger(kind,amount,balance_after,note,operation_key,created_at,owner_id) VALUES(?,?,?,?,?,?,?)').run('credit',20000,20000,'isolated migration fixture','fixture-'+id,new Date().toISOString(),id);
   before.push(store.asUser(id,()=>store.claim(task.id,quote)));
  }
  store.close();store=null;
  assert.doesNotThrow(()=>{store=createStore(file);});
  for(const a of before){const restored=store.asUser(a.owner_id,()=>store.assignment(a.id));assert.equal(restored.status,'active');assert.equal(restored.task.deposit,10000);assert.equal(restored.task.commission,750);assert.equal(store.asUser(a.owner_id,()=>store.summary()).wallet.available,10000);}
  assert.equal(store.db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='index' AND name='one_live_task'").get().n,0);
 }finally{store?.close();await rm(dir,{recursive:true,force:true});}
});
