// Historical stage compatibility only. The active task flow is stage 3 (50 tasks per round).
// These stored amounts and schemas preserve historical records; they do not define current task pricing.
import {createEarlyStagePolicy} from './early-stage-policy.mjs';
import {createCommunityLicenses} from './community-licenses.mjs';
import {createNewcomerCovers} from './newcomer-covers.mjs';
export function createStageJourney(store){
 const db=store.db,covers=createNewcomerCovers(store),licenses=createCommunityLicenses(store);
 db.exec(`CREATE TABLE IF NOT EXISTS community_progress(owner_id TEXT PRIMARY KEY,completed INTEGER NOT NULL DEFAULT 0,revealed INTEGER NOT NULL DEFAULT -1,answers TEXT NOT NULL DEFAULT '{}',code TEXT NOT NULL,updated_at TEXT NOT NULL);`);
 db.exec('CREATE TABLE IF NOT EXISTS onboarding_reveals(owner_id TEXT NOT NULL,step INTEGER NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(owner_id,step))');
 db.exec('CREATE TABLE IF NOT EXISTS identity_reward_notices(owner_id TEXT PRIMARY KEY,seen_at TEXT NOT NULL)');
 db.exec('CREATE TABLE IF NOT EXISTS newcomer_withdrawal_skips(owner_id TEXT PRIMARY KEY,skipped_at TEXT NOT NULL)');
 const has=(sql,id)=>!!db.prepare(sql).get(id);
 function newcomer(id){
  const registration=has("SELECT 1 FROM ledger WHERE owner_id=? AND kind='registration_reward'",id);
  const identity=has("SELECT 1 FROM identities WHERE user_id=? AND status='approved'",id);
  const experience=has("SELECT 1 FROM assignments a JOIN assignment_terms f ON f.assignment_id=a.id WHERE a.owner_id=? AND f.stage=1 AND a.status='completed'",id)||has("SELECT 1 FROM newcomer_cover_orders WHERE owner_id=? AND state='completed'",id);
  const card=has("SELECT 1 FROM bank_cards WHERE user_id=? AND status='approved'",id);
  const withdrawal=has("SELECT 1 FROM fund_requests WHERE user_id=? AND kind='withdrawal' AND (status='paid' OR newcomer_task=1)",id);
  const withdrawalSkipped=has('SELECT 1 FROM newcomer_withdrawal_skips WHERE owner_id=?',id);
  const graduate=has("SELECT 1 FROM ledger WHERE owner_id=? AND operation_key='newcomer-graduate:'||owner_id",id);
  return {registration,identity,experience,card,withdrawal,withdrawalSkipped,graduate,complete:identity&&experience&&card&&(withdrawalSkipped||graduate)};
 }
 function progress(id){const row=db.prepare('SELECT * FROM community_progress WHERE owner_id=?').get(id);return row?{license:row.revealed===row.completed?licenses.snapshot(id,row.completed):null,completed:row.completed,revealed:row.revealed,answers:JSON.parse(row.answers),code:row.revealed===4||row.completed===5?row.code:null}:{completed:0,revealed:-1,answers:{},code:null};}
  function snapshot(id){
   const n=newcomer(id),states=[true,n.identity,n.experience,n.card,n.withdrawal||n.withdrawalSkipped,n.graduate||n.withdrawalSkipped];
   const running=db.prepare("SELECT 1 FROM assignments a JOIN assignment_terms f ON f.assignment_id=a.id WHERE a.owner_id=? AND f.stage=1 AND a.status IN ('active','review','revision')").get(id);
   const found=running?2:states.findIndex(done=>!done),step=found<0?null:found;
  const pendingWithdrawal=db.prepare("SELECT id,status,amount,created_at FROM fund_requests WHERE user_id=? AND kind='withdrawal' AND status IN ('review','paying') ORDER BY created_at DESC LIMIT 1").get(id)||null;
  const identityReview=db.prepare('SELECT status,note FROM identities WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1').get(id)||null;
  const withdrawalSkipped=!!db.prepare('SELECT 1 FROM newcomer_withdrawal_skips WHERE owner_id=?').get(id);
  return {earlyStageTerms:createEarlyStagePolicy(store).effective(id),identityReview,walletAvailable:db.prepare('SELECT COALESCE(SUM(amount),0) n FROM ledger WHERE owner_id=?').get(id).n,pendingWithdrawal,newcomer:{...n,withdrawalSkipped},withdrawalInProgress:!!pendingWithdrawal,cover:covers.snapshot(id),onboarding:{step,revealed:step!==null&&(step===4&&!!pendingWithdrawal||!!running||!!db.prepare('SELECT 1 FROM onboarding_reveals WHERE owner_id=? AND step=?').get(id,step))},community:progress(id)};
 }
 return {snapshot};
}
