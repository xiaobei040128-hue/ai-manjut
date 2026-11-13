import {adminReviewNotices,initializeAdminReviewNotices} from '../server/admin-review-notices.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {directoryFixture} from './helpers/customer-directory-fixture.mjs';
import {createAdminCustomerHistory} from '../server/admin-customer-history.mjs';
import {customerDirectory} from '../server/customer-directory.mjs';
const token=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
function fixture(){
 const f=directoryFixture(4),db=f.db;
 db.exec('UPDATE commission_policy SET rate_bps=700;BEGIN');
 for(const owner of f.ids.slice(0,2))for(let i=0;i<110;i++){
  const id=owner+'-history-'+String(i).padStart(3,'0'),at=new Date(Date.UTC(2026,0,1,0,Math.floor(i/5))).toISOString();
  db.prepare("INSERT INTO assignments(id,task_id,status,created_at,deadline,reviewed_at,owner_id) VALUES(?,'detail-work','completed',?,?,?,?)").run(id,at,at,at,owner);
  if(i%2===0)db.prepare('INSERT INTO assignment_terms(assignment_id,amount,commission,rate_bps,stage) VALUES(?,?,?,100,3)').run(id,7000+i,17+i);
  db.prepare('INSERT INTO events(assignment_id,type,description,created_at) VALUES(?,?,?,?)').run(id,'fixture','PRIVATE_AUXILIARY_'+owner+' '+('x'.repeat(2000)),at);
  db.prepare('INSERT INTO ledger(assignment_id,kind,amount,balance_after,note,operation_key,created_at,owner_id) VALUES(?,?,?,?,?,?,?,?)').run(id,'reward',10,10000+(i+1)*10,'Private '+owner+' '+i,id,at,owner);
 }
 db.exec('COMMIT');return {...f,history:createAdminCustomerHistory(f.store,f.scope)};
}
test('admin task pages retain every locked and legacy quote, stable equal-time order and no auxiliary history graph',()=>{
 const f=fixture();try{
  const owner=f.ids[0],expected=f.store.summary({owners:[owner]}).assignments,byId=new Map(expected.map(row=>[row.id,row]));
  let cursor=null,rows=[];do{const page=f.history.records(f.agent,owner,{cursor});assert.equal(page.total,111);assert.ok(page.items.length<=25);assert.ok(page.items.every(row=>row.owner_id===owner&&!('events'in row)&&!('uploads'in row)));assert.ok(!JSON.stringify(page).includes('PRIVATE_AUXILIARY_'));rows.push(...page.items);cursor=page.nextCursor;}while(cursor);
  assert.equal(rows.length,111);assert.equal(new Set(rows.map(row=>row.id)).size,111);
  for(const row of rows){assert.equal(row.task.deposit,byId.get(row.id).task.deposit);assert.equal(row.task.commission,byId.get(row.id).task.commission);}
  assert.equal(rows.find(row=>row.id.endsWith('-000')).task.commission,17);assert.equal(rows.find(row=>row.id.endsWith('-001')).task.commission,Math.round(f.db.prepare("SELECT deposit FROM tasks WHERE id='detail-work'").get().deposit*700/10000));
  const first=f.history.records(f.agent,owner);f.db.prepare("INSERT INTO assignments(id,task_id,status,created_at,deadline,owner_id) VALUES('admin-new','detail-work','completed','2026-12-01','2026-12-01',?)").run(owner);
  const second=f.history.records(f.agent,owner,{cursor:first.nextCursor});assert.equal(second.total,112);assert.ok(!second.items.some(row=>first.items.some(old=>old.id===row.id)));assert.equal(f.history.records(f.agent,owner).items[0].id,'admin-new');
 }finally{f.close();}
});
test('admin ledger pages retain raw notes and full account aggregates while new writes do not repeat prior page rows',()=>{
 const f=fixture();try{
  const owner=f.ids[0],before=customerDirectory(f.store,f.auth,f.scope,f.agent,'all',owner)[0],first=f.history.ledger(f.agent,owner);assert.equal(first.items.length,25);assert.equal(first.total,111);
  f.db.prepare("INSERT INTO ledger(kind,amount,balance_after,note,operation_key,created_at,owner_id) VALUES('admin_credit',123,11223,'后台上分 · raw note','admin-late-ledger','2026-12-01',?)").run(owner);
  let cursor=first.nextCursor,rows=[...first.items];while(cursor){const page=f.history.ledger(f.agent,owner,{cursor});assert.equal(page.total,112);assert.ok(page.items.length<=25);rows.push(...page.items);cursor=page.nextCursor;}
  assert.equal(rows.length,111);assert.equal(new Set(rows.map(row=>row.id)).size,111);assert.ok(rows.every(row=>row.owner_id===owner&&!row.note.includes(f.ids[1])));
  assert.equal(f.history.ledger(f.agent,owner).items[0].note,'后台上分 · raw note');const after=customerDirectory(f.store,f.auth,f.scope,f.agent,'all',owner)[0];assert.equal(after.wallet.available,before.wallet.available+123);assert.equal(after.wallet.held,before.wallet.held);assert.equal(after.wallet.earned,before.wallet.earned);
 }finally{f.close();}
});
test('admin history rejects foreign customers, malformed positions and reassigned ownership on every page',()=>{
 const f=fixture();try{
  for(const kind of ['records','ledger']){
   assert.throws(()=>f.history[kind](f.agent,f.ids[1]),e=>e.status===403);assert.throws(()=>f.history[kind](f.superOperator,'missing'),e=>e.status===404);
   for(const cursor of ['!',token({}),token({id:kind==='ledger'?-1:'a',at:'bad'}),'x'.repeat(401),1])assert.throws(()=>f.history[kind](f.agent,f.ids[0],{cursor}),e=>e.status===400);
   const foreign=f.history[kind](f.superOperator,f.ids[1]).nextCursor;assert.ok(f.history[kind](f.agent,f.ids[0],{cursor:foreign}).items.every(row=>row.owner_id===f.ids[0]));
  }
  const next=f.history.records(f.agent,f.ids[0]).nextCursor;f.db.prepare('UPDATE invitations SET owner_id=? WHERE id=?').run('detail-agent-b',f.invites[0].id);assert.throws(()=>f.history.records(f.agent,f.ids[0],{cursor:next}),e=>e.status===403);assert.throws(()=>f.history.ledger(f.agent,f.ids[0]),e=>e.status===403);
 }finally{f.close();}
});

test('review notices return only current owned pending withdrawal identifiers, including ownership and status changes',()=>{
 const f=fixture();try{
  initializeAdminReviewNotices(f.db);
  f.db.prepare("INSERT INTO fund_requests(id,user_id,kind,amount,status,created_at,operation_key) VALUES('foreign-review',?,'withdrawal',9999,'review','2026-11-01','foreign-review-key')").run(f.ids[1]);
  f.db.prepare("INSERT INTO fund_requests(id,user_id,kind,amount,status,created_at,operation_key) VALUES('own-paid',?,'withdrawal',9999,'paid','2026-11-01','own-paid-key')").run(f.ids[0]);
  const own=adminReviewNotices(f.db,f.agent);assert.deepEqual(own.requests.map(row=>row.id),['detail-withdrawal']);assert.ok(own.requests.every(row=>Object.keys(row).sort().join(',')==='created_at,id,kind,status'));assert.equal(adminReviewNotices(f.db,f.superOperator).requests.length,2);
  f.db.prepare("UPDATE fund_requests SET status='paid' WHERE id='detail-withdrawal'").run();assert.equal(adminReviewNotices(f.db,f.agent).requests.length,0);
  f.db.prepare('UPDATE invitations SET owner_id=? WHERE id=?').run(f.agent.id,f.invites[1].id);assert.deepEqual(adminReviewNotices(f.db,f.agent).requests.map(row=>row.id),['foreign-review']);
 }finally{f.close();}
});
