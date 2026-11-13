import {createEarlyStagePolicy} from './early-stage-policy.mjs';
import {readFileSync} from 'node:fs';
const lawyerArtwork=JSON.parse(readFileSync(new URL('./newcomer-artwork.json',import.meta.url),'utf8'));
import {randomBytes,randomInt,randomUUID} from 'node:crypto';
import {AppError} from './store.mjs';
export const NEWCOMER_COVER_PRICE=188;
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
 const legacyRunning=id=>db.prepare("SELECT 1 FROM assignments a JOIN assignment_terms f ON f.assignment_id=a.id WHERE a.owner_id=? AND f.stage=1 AND a.status IN ('active','review','revision')").get(id);
 function identity(id){if(!db.prepare("SELECT 1 FROM identities WHERE user_id=? AND status='approved'").get(id))throw new AppError('请先完成实名认证',403);}
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
 function post(row,kind,amount,key,note){
  const balance=db.prepare('SELECT COALESCE(SUM(amount),0) n FROM ledger WHERE owner_id=?').get(row.owner_id).n;
  if(balance+amount<0)throw new AppError('可用余额不足',409);
  db.prepare('INSERT INTO ledger(kind,amount,balance_after,note,operation_key,created_at,owner_id) VALUES(?,?,?,?,?,?,?)').run(kind,amount,balance+amount,note,key,new Date().toISOString(),row.owner_id);
 }
 return {
  snapshot(id){return view(get(id));},
  reveal(id){return store.asUser(id,()=>store.audited(id,'newcomer.cover.reveal',id,()=>{
   identity(id);if(legacyRunning(id))throw new AppError('请先完成已接受的体验任务',409);
   const old=get(id);if(old)return view(old);
   const tasks=store.summary().tasks.filter(t=>t.active&&t.stage===1);
   if(!tasks.length)throw new AppError('封面正在准备中，请稍后再来',409);
   const hasOffers=!!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stage_task_offers'").get();
   const prior=hasOffers?db.prepare('SELECT task_id FROM stage_task_offers WHERE owner_id=? AND stage=1 AND assignment_id IS NULL AND retired=0').get(id):null;
   const selected=tasks.find(t=>t.id===prior?.task_id)||tasks[randomInt(tasks.length)];
   const artwork={...lawyerArtwork,episodes:null,language:''};
   db.prepare('INSERT INTO newcomer_cover_orders(id,owner_id,source_task_id,artwork,created_at) VALUES(?,?,?,?,?)').run(randomUUID(),id,selected.id,JSON.stringify(artwork),new Date().toISOString());
   // Preserve superseded, unpaid offers in the audit history without blocking later stages.
   if(hasOffers)db.prepare('UPDATE stage_task_offers SET retired=1 WHERE owner_id=? AND stage=1 AND assignment_id IS NULL').run(id);
   return view(get(id));
  }));},
  purchase(id,input){return store.asUser(id,()=>store.audited(id,'newcomer.cover.purchase',id,()=>{
   identity(id);if(legacyRunning(id))throw new AppError('请先完成已接受的体验任务',409);
   const row=get(id);if(!row||row.id!==input.orderId)throw new AppError('请先领取当前封面任务',404);
   if(row.state!=='offered')return view(row);
   const quote=view(row),expected=input.expected;
   if(quote.rateBps===null)throw new AppError('购买暂未开放',409);
   if(!expected||expected.amount!==quote.amount||expected.commission!==quote.commission||expected.rateBps!==quote.rateBps)throw new AppError('结算信息已更新，请刷新后确认',409);
   const task=store.getTask(row.source_task_id);
   if(!task.active)throw new AppError('此封面暂不可购买',409);
   const code='COV-'+randomBytes(9).toString('hex').toUpperCase();
   post(row,'hold',-quote.amount,'cover-hold:'+row.id,'购买版权封面 · '+quote.artwork.title);
   db.prepare("UPDATE newcomer_cover_orders SET state='purchased',code=?,commission=?,rate_bps=?,purchased_at=?,amount=? WHERE id=?").run(code,quote.commission,quote.rateBps,new Date().toISOString(),quote.amount,row.id);
   store.notifyUser(id,'版权封面购买成功','版权码已生成，可在当前任务中查看并提交。','stage','newcomer-cover:'+row.id);
   return view(get(id));
  }));},
  submit(id,input){return store.asUser(id,()=>store.audited(id,'newcomer.cover.complete',id,()=>{
   const row=get(id);
   if(!row||row.id!==input.orderId||row.state==='offered')throw new AppError('请先购买当前版权封面',404);
   if(typeof input.code!=='string'||input.code!==row.code)throw new AppError('版权码与当前购买记录不匹配',400);
   if(row.state==='completed')return {cover:view(row),first:false};
   post(row,'release',row.amount,'cover-release:'+row.id,'版权码核验完成 · 本金返还');
   post(row,'reward',row.commission,'cover-reward:'+row.id,'版权封面任务完成 · 佣金到账');
   db.prepare("UPDATE newcomer_cover_orders SET state='completed',completed_at=? WHERE id=?").run(new Date().toISOString(),row.id);
   store.notifyUser(id,'封面任务已完成','版权码已核验，返还本金与佣金已计入钱包。','finance',row.id);
   return {cover:view(get(id)),first:true};
  }));}
 };
}
