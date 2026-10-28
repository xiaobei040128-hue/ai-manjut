import {readFileSync} from 'node:fs';
import {AppError} from './store.mjs';
const defaults=JSON.parse(readFileSync(new URL('../shared/deposit-channels.json',import.meta.url),'utf8'));
const compatible=channels=>channels.map(c=>({...c,uid:c.uid||'',asset:c.asset||'',routes:c.routes||[]}));
export function normalizeDepositSettings(input,previous){
 if(!Array.isArray(input.channels)||input.channels.length!==defaults.length)throw new AppError('充值渠道列表不完整');
 const supportUrl=input.supportUrl===undefined?previous.supportUrl:input.supportUrl;
 if(typeof supportUrl!=='string'||supportUrl.length>1000)throw new AppError('客服链接格式无效');
 if(supportUrl){let url;try{url=new URL(supportUrl);}catch{throw new AppError('请填写完整的 HTTPS 客服链接');}if(url.protocol!=='https:'||url.username||url.password)throw new AppError('客服链接必须使用 HTTPS 且不能包含登录凭证');}
 const channels=defaults.map(d=>{
  const values=input.channels.filter(c=>c&&c.id===d.id);if(values.length!==1)throw new AppError('充值渠道标识无效');const c=values[0],out={...d};
  if(typeof c.enabled!=='boolean')throw new AppError('渠道状态无效');out.enabled=c.enabled;
  for(const [k,max] of [['name',40],['network',100],['recipient',150],['account',500],['instructions',2000],['unavailableMessage',150]]){if(typeof c[k]!=='string'||c[k].length>max)throw new AppError('充值详情格式或长度无效');out[k]=c[k].trim();}
  out.uid=typeof c.uid==='string'?c.uid.trim():'';out.asset=typeof c.asset==='string'?c.asset.trim():'';
  if(out.uid.length>40||out.asset.length>20||out.uid&&!/^\d{4,30}$/.test(out.uid))throw new AppError('请填写 4–30 位数字 UID');
  if(!Array.isArray(c.routes||[])||(c.routes||[]).length>10)throw new AppError('每个渠道最多配置10个网络');
  out.routes=(c.routes||[]).map(r=>{if(!r||typeof r!=='object')throw new AppError('网络配置格式无效');const value={};for(const [key,max] of [['id',80],['asset',20],['network',100],['address',200],['memo',150]]){if(typeof r[key]!=='string'||r[key].length>max)throw new AppError('网络配置格式无效');value[key]=r[key].trim();}if(!value.id)throw new AppError('网络标识不能为空');return value;});
  if(new Set(out.routes.map(r=>r.id)).size!==out.routes.length)throw new AppError('网络标识不能重复');if(!out.name)throw new AppError('请填写渠道名称');return out;
 });return {channels,supportUrl:supportUrl.trim()};
}
export function resolveDepositChannel(settings,id,method){
 if(id===undefined||id==='')return null;
 const c=settings.channels.find(c=>c.id===id);if(!c)throw new AppError('请选择有效的充值渠道');
 if(!c.enabled)throw new AppError(c.unavailableMessage||'当前区域暂未开通',409);
 if(c.id==='bank_wire')throw new AppError('银行电汇请联系客服',409);
 if(method==='legacy'&&!c.uid&&!c.routes.some(r=>r.address)&&c.account)return c;
 if(method){if(method==='uid'){if(!['binance','okx'].includes(c.id)||!c.uid)throw new AppError('此渠道暂未开通 UID 转账',409);return {...c,method:'uid',methodLabel:'UID 内部转账'};}const route=c.routes.find(r=>r.id===method);if(!route||!route.asset||!route.network||!route.address)throw new AppError('请选择已配置的转账网络',409);return {...c,method:route.id,methodLabel:route.asset+' · '+route.network};}
 if(c.uid||c.routes.some(r=>r.address))throw new AppError('请选择转账方式或网络',409);
 if(!c.account)throw new AppError('该渠道暂不可用，请选择其他充值方式',409);return c;
}
export function createDepositChannels(store){
 const db=store.db;db.exec('CREATE TABLE IF NOT EXISTS deposit_channel_settings(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,channels TEXT NOT NULL)');
 if(!db.prepare('PRAGMA table_info(deposit_channel_settings)').all().some(c=>c.name==='support_url'))db.exec("ALTER TABLE deposit_channel_settings ADD COLUMN support_url TEXT NOT NULL DEFAULT ''");
 const snapshot=()=>{const row=db.prepare('SELECT * FROM deposit_channel_settings WHERE id=1').get();return {revision:row?.revision||0,supportUrl:row?.support_url||'',channels:compatible(row?JSON.parse(row.channels):structuredClone(defaults))};};
 return {snapshot,save(actor,input){const previous=snapshot();if(input.revision!==previous.revision)throw new AppError('配置已更新，请重新读取后修改',409);const {channels,supportUrl}=normalizeDepositSettings(input,previous);return store.audited(actor,'deposit.channels.update','global',()=>{const current=snapshot();if(current.revision!==input.revision)throw new AppError('配置已更新，请重新读取后修改',409);db.prepare('INSERT INTO deposit_channel_settings(id,revision,channels,support_url) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,channels=excluded.channels,support_url=excluded.support_url').run(current.revision+1,JSON.stringify(channels),supportUrl);return snapshot();});},resolve(id,method){return resolveDepositChannel(snapshot(),id,method);}};
}
