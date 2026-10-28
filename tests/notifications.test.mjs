import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../server/store.mjs';

test('notification pagination stays isolated, stable and complete beyond the bootstrap window',()=>{
 const s=createStore(':memory:');
 try{
  for(const owner of ['owner-a','owner-b'])s.db.prepare('INSERT INTO creator_profiles VALUES(?,?,?,?,?)').run(owner,owner,'','',new Date().toISOString());
  for(let n=1;n<=125;n++)s.notifyUser('owner-a','通知 '+n,'同一秒的消息也按稳定序号排序','finance','record-'+n);
  for(let n=1;n<=5;n++)s.notifyUser('owner-b','另一客户 '+n,'不应泄露','finance','foreign-'+n);
  const page=before=>s.asUser('owner-a',()=>s.notifications({limit:20,before}));
  const first=page();assert.equal(first.notifications.length,20);assert.equal(first.unreadCount,125);assert.equal(first.notifications[0].title,'通知 125');assert.ok(first.nextCursor);
  const second=page(first.nextCursor);assert.equal(second.notifications[0].title,'通知 105');
  s.notifyUser('owner-a','新到消息','翻页过程中插入','general');
  const collected=[...first.notifications,...second.notifications];let cursor=second.nextCursor;
  while(cursor){const result=page(cursor);collected.push(...result.notifications);cursor=result.nextCursor;}
  assert.equal(collected.length,125);assert.equal(new Set(collected.map(n=>n.id)).size,125);assert.ok(collected.every(n=>n.owner_id==='owner-a'));
  const bootstrap=s.asUser('owner-a',()=>s.summary());assert.equal(bootstrap.notifications.length,100);assert.equal(bootstrap.notificationsUnread,126);
  const foreign=s.asUser('owner-b',()=>s.notifications()).notifications[0];assert.throws(()=>s.asUser('owner-a',()=>s.readNotifications(foreign.id)),e=>e.status===404);
  s.asUser('owner-a',()=>s.readNotifications(first.notifications[0].id));assert.equal(s.asUser('owner-a',()=>s.notifications({unread:true})).unreadCount,125);
  s.asUser('owner-a',()=>s.readNotifications());assert.equal(s.asUser('owner-a',()=>s.notifications({unread:true})).notifications.length,0);assert.equal(s.asUser('owner-a',()=>s.summary()).notificationsUnread,0);
  assert.equal(s.asUser('owner-b',()=>s.notifications()).unreadCount,5);
  for(const options of [{limit:0},{limit:101},{before:0},{before:Number.MAX_SAFE_INTEGER+1},{unread:'true'}])assert.throws(()=>s.asUser('owner-a',()=>s.notifications(options)),e=>e.status===400);
 }finally{s.close();}
});
