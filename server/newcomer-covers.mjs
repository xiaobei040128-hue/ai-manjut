// Historical stage compatibility only. The active task flow is stage 3 (50 tasks per round).
// These stored amounts and schemas preserve historical records; they do not define current task pricing.
import {createEarlyStagePolicy} from './early-stage-policy.mjs';
import {readFileSync} from 'node:fs';
const lawyerArtwork=JSON.parse(readFileSync(new URL('./newcomer-artwork.json',import.meta.url),'utf8'));
export function createNewcomerCovers(store){
 const db=store.db;
 db.exec(`CREATE TABLE IF NOT EXISTS newcomer_cover_orders(
  id TEXT PRIMARY KEY,owner_id TEXT NOT NULL UNIQUE,source_task_id TEXT NOT NULL,
  artwork TEXT NOT NULL,amount INTEGER NOT NULL DEFAULT 188 CHECK(amount=188),
  state TEXT NOT NULL DEFAULT 'offered' CHECK(state IN ('offered','purchased','completed')),
  code TEXT UNIQUE,commission INTEGER,rate_bps INTEGER,created_at TEXT NOT NULL,purchased_at TEXT,completed_at TEXT);`);
 if(db.prepare("SELECT sql FROM sqlite_master WHERE name='newcomer_cover_orders'").get().sql.includes('CHECK(amount=188)')){db.exec(`BEGIN;ALTER TABLE newcomer_cover_orders RENAME TO newcomer_cover_orders_legacy;CREATE TABLE newcomer_cover_orders(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL UNIQUE,source_task_id TEXT NOT NULL,artwork TEXT NOT NULL,amount INTEGER NOT NULL DEFAULT 188 CHECK(amount>0),state TEXT NOT NULL DEFAULT 'offered' CHECK(state IN ('offered','purchased','completed')),code TEXT UNIQUE,commission INTEGER,rate_bps INTEGER,created_at TEXT NOT NULL,purchased_at TEXT,completed_at TEXT);INSERT INTO newcomer_cover_orders SELECT * FROM newcomer_cover_orders_legacy;DROP TABLE newcomer_cover_orders_legacy;COMMIT;`);}
 db.exec('CREATE TABLE IF NOT EXISTS early_cover_quotes(order_id TEXT PRIMARY KEY,amount INTEGER NOT NULL,rate_bps INTEGER)');
 const get=id=>db.prepare('SELECT * FROM newcomer_cover_orders WHERE owner_id=?').get(id);
 function view(row){
  if(!row)return null;
  if(row.state==='offered'){
   const next={...lawyerArtwork,episodes:null,language:''};
   if(row.artwork!==JSON.stringify(next))db.prepare("UPDATE newcomer_cover_orders SET artwork=? WHERE id=? AND state='offered'").run(JSON.stringify(next),row.id);
   row={...row,artwork:JSON.stringify(next)};
  }
  let config=createEarlyStagePolicy(store).effective(row.owner_id).cover;const frozen=db.prepare('SELECT amount,rate_bps AS rateBps FROM early_cover_quotes WHERE order_id=?').get(row.id);if(frozen)config=frozen;else if(row.state==='offered'&&config.rateBps!==null)db.prepare('INSERT OR IGNORE INTO early_cover_quotes VALUES(?,?,?)').run(row.id,config.amount,config.rateBps);const rate=row.state==='offered'?config.rateBps:row.rate_bps;const amount=row.state==='offered'?config.amount:row.amount;
  return {id:row.id,artwork:JSON.parse(row.artwork),amount,state:row.state,code:row.code,
   commission:row.state==='offered'?(rate===null?null:Math.round(amount*rate/10000)):row.commission,rateBps:rate};
 }
 return {snapshot(id){return view(get(id));}};
}
