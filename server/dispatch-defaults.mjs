import {parseBalancePricing} from './balance-pricing.mjs';
import {AppError} from './store.mjs';
export function parsePremiumDefaults(p){
 if(!p||typeof p!=='object')throw new AppError('请填写高阶订单默认设置');
 if(p.amountAdd!==undefined){const read=(v,max,label)=>{if(!/^\d+(\.\d{1,2})?$/.test(String(v))||Number(v)<0||Number(v)>max)throw new AppError(label+'无效，最多两位小数');return Number(v);};return {amountAdd:Math.round(read(p.amountAdd,1000000,'高阶增加金额')*100),commissionMultiplier:read(p.commissionMultiplier,100,'高阶佣金倍数')};}
 const read=(v,min,max)=>{if(!/^\d+(\.\d{1,2})?$/.test(String(v))||Number(v)<min||Number(v)>max)throw new AppError('高阶金额比例需为0.01%–1000%，佣金倍数需为0–100，最多两位小数');return Number(v);};
 const minPercent=read(p.minPercent,.01,1000),maxPercent=read(p.maxPercent,.01,1000),minMultiplier=read(p.minMultiplier,0,100),maxMultiplier=read(p.maxMultiplier,0,100);
 if(minPercent>maxPercent||minMultiplier>maxMultiplier)throw new AppError('最低值不能高于最高值');
 return {minPercent,maxPercent,minMultiplier,maxMultiplier};
}
function parseOrdinaryCommission(input){
 const parse=value=>{
  if(!/^\d+(\.\d{1,2})?$/.test(String(value))||Number(value)>100)
   throw new AppError('普通佣金率须为 0% 至 100%，最多两位小数');
  return Number(value);
 };
 const minPercent=parse(input?.minPercent),maxPercent=parse(input?.maxPercent);
 if(minPercent>maxPercent)throw new AppError('最低佣金率不能高于最高佣金率');
 return {minPercent,maxPercent};
}
export function dispatchDefaults(db){
 db.exec('CREATE TABLE IF NOT EXISTS dispatch_ordinary_commission(id INTEGER PRIMARY KEY CHECK(id=1),min_percent REAL NOT NULL,max_percent REAL NOT NULL)');
 const ordinary=db.prepare('SELECT min_percent,max_percent FROM dispatch_ordinary_commission WHERE id=1').get();
 db.exec('CREATE TABLE IF NOT EXISTS dispatch_defaults(id INTEGER PRIMARY KEY CHECK(id=1),min_percent REAL NOT NULL,max_percent REAL NOT NULL,revision INTEGER NOT NULL,updated_at TEXT NOT NULL)');
 db.exec('CREATE TABLE IF NOT EXISTS dispatch_premium_defaults(id INTEGER PRIMARY KEY CHECK(id=1),configuration TEXT NOT NULL)');
 const row=db.prepare('SELECT * FROM dispatch_defaults WHERE id=1').get(),high=db.prepare('SELECT configuration FROM dispatch_premium_defaults WHERE id=1').get();
 return {ordinaryCommission:{minPercent:ordinary?.min_percent??0.56,maxPercent:ordinary?.max_percent??0.68},balancePricing:{minPercent:row?.min_percent??20,maxPercent:row?.max_percent??75},premium:high?JSON.parse(high.configuration):{minPercent:150,maxPercent:200,minMultiplier:6,maxMultiplier:9},revision:row?.revision??0,updatedAt:row?.updated_at??null};
}
export function saveDispatchDefaults(store,actor,input){
 const db=store.db,pricing=parseBalancePricing(input.balancePricing);
 if(!pricing)throw new AppError('请填写最低和最高派单比例');
 if(!Number.isSafeInteger(input.revision)||input.revision<0)throw new AppError('请重新读取派单比例');
 return store.audited(actor,'dispatch.defaults','global',()=>{
  const previous=dispatchDefaults(db);if(previous.revision!==input.revision)throw new AppError('默认比例已被其他页面修改，请重新读取',409);
  if(input.ordinaryCommission!==undefined){
   const range=parseOrdinaryCommission(input.ordinaryCommission);
   db.prepare('INSERT INTO dispatch_ordinary_commission VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET min_percent=excluded.min_percent,max_percent=excluded.max_percent').run(range.minPercent,range.maxPercent);
  }
  const premium=input.premium===undefined?previous.premium:parsePremiumDefaults(input.premium);
  db.prepare('INSERT INTO dispatch_defaults(id,min_percent,max_percent,revision,updated_at) VALUES(1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET min_percent=excluded.min_percent,max_percent=excluded.max_percent,revision=excluded.revision,updated_at=excluded.updated_at').run(pricing.minPercent,pricing.maxPercent,input.revision+1,new Date().toISOString());
  db.prepare('INSERT INTO dispatch_premium_defaults VALUES(1,?) ON CONFLICT(id) DO UPDATE SET configuration=excluded.configuration').run(JSON.stringify(premium));
  return dispatchDefaults(db);
 });
}
