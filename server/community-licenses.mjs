// Historical stage compatibility only. The active task flow is stage 3 (50 tasks per round).
// These stored amounts and schemas preserve historical records; they do not define current task pricing.
import {readFileSync} from 'node:fs';
import {createTaskBalance} from './task-balance.mjs';
const fixedStories=JSON.parse(readFileSync(new URL('./community-stories.json',import.meta.url),'utf8'));
export function createCommunityLicenses(store){
 const db=store.db,balance=createTaskBalance(store);
 db.exec(`CREATE TABLE IF NOT EXISTS community_license_orders(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,step INTEGER NOT NULL,artwork TEXT NOT NULL,amount INTEGER NOT NULL,commission INTEGER NOT NULL,rate_bps INTEGER NOT NULL,state TEXT NOT NULL DEFAULT 'offered',code TEXT UNIQUE,created_at TEXT NOT NULL,UNIQUE(owner_id,step));`);
 for(const step of [3,4])db.prepare("UPDATE community_license_orders SET artwork=? WHERE step=? AND state='offered'").run(JSON.stringify(fixedStories[step-3]),step);
 const row=(user,step)=>db.prepare('SELECT * FROM community_license_orders WHERE owner_id=? AND step=?').get(user,step);
 const view=r=>r?{id:r.id,step:r.step,artwork:JSON.parse(r.artwork),amount:r.amount,commission:r.commission,state:r.state,code:r.code,reservedAmount:balance.amount(r.owner_id,'community',r.id)}:null;
 return {snapshot(user,step){return view(row(user,step));}};
}
