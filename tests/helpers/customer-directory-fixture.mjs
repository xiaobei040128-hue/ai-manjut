import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createStore} from '../../server/store.mjs';
import {createCreatorAuth} from '../../server/creator-auth.mjs';
import {createAdminAuth} from '../../server/auth.mjs';
import {createFinance} from '../../server/finance.mjs';
import {createStageDispatch} from '../../server/stage-dispatch.mjs';
import {createOperatorScope} from '../../server/operators.mjs';
import {initializeThirdPlan} from '../../server/third-plan.mjs';

export function directoryFixture(count=40){
 mkdirSync('work',{recursive:true});const folder=mkdtempSync(resolve('work/directory-detail-'));
 const store=createStore(':memory:',{fixtures:true,fixtureCatalog:[['detail-work','Test work','',1,'en',1000,10,1,'Mystery','Test description','/stories/test.webp','',1000]]}),db=store.db;
 try{
  const auth=createCreatorAuth(store,4999);createAdminAuth(store,4999);createFinance(store,folder);createStageDispatch(store);initializeThirdPlan(db);db.exec('UPDATE tasks SET stage=3');
  const now='2026-11-01T00:00:00.000Z',agents=['detail-agent-a','detail-agent-b'];
  for(const id of agents)db.prepare('INSERT INTO agent_admins(id,username,password_hash,salt,created_at) VALUES(?,?,?,?,?)').run(id,id,'unused-fixture-hash','unused-fixture-salt',now);
  const invites=agents.map(id=>auth.createInvite('fixture',{},id)),ids=[];
  db.exec('BEGIN');
  for(let i=0;i<count;i++){
   const id='detail-user-'+i;ids.push(id);
   db.prepare('INSERT INTO creator_accounts(id,email,password_hash,salt,created_at,invite_id,customer_type) VALUES(?,?,?,?,?,?,?)').run(id,id+'@example.invalid','unused-fixture-hash','unused-fixture-salt',now,invites[i%2].id,i%3===0?'test':'real');
   db.prepare('INSERT INTO creator_profiles VALUES(?,?,?,?,?)').run(id,'User '+i,'','',now);
   db.prepare('INSERT INTO ledger(kind,amount,balance_after,note,operation_key,created_at,owner_id) VALUES(?,?,?,?,?,?,?)').run('admin_credit',10000+i,10000+i,'Isolated fixture','detail-credit-'+i,now,id);
  }
  db.prepare('INSERT INTO assignments(id,task_id,status,created_at,deadline,owner_id) VALUES(?,?,?,?,?,?)').run('detail-active','detail-work','active',now,now,ids[0]);
  db.prepare('INSERT INTO assignment_terms(assignment_id,amount,commission,rate_bps,stage) VALUES(?,1000,10,100,3)').run('detail-active');
  db.prepare('INSERT INTO fund_requests(id,user_id,kind,amount,status,created_at,operation_key) VALUES(?,?,?,?,?,?,?)').run('detail-withdrawal',ids[0],'withdrawal',2000,'review',now,'detail-withdrawal-key');
  db.exec('COMMIT');
  return {store,db,auth,ids,invites,scope:createOperatorScope(store),superOperator:{role:'super',id:'super',username:'fixture'},agent:{role:'agent',id:agents[0],username:agents[0]},close(){store.close();rmSync(folder,{recursive:true,force:true});}};
 }catch(error){store.close();rmSync(folder,{recursive:true,force:true});throw error;}
}
