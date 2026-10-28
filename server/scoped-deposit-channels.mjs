import {AppError} from './store.mjs';
import {normalizeDepositSettings,resolveDepositChannel} from './deposit-channels.mjs';
import {createAgentPermissions} from './agent-permissions.mjs';
export function createScopedDepositChannels(store,global){
 const db=store.db,permissions=createAgentPermissions(store);
 db.exec('CREATE TABLE IF NOT EXISTS agent_deposit_settings(owner_id TEXT PRIMARY KEY,revision INTEGER NOT NULL,channels TEXT,support_url TEXT)');
 const row=id=>db.prepare('SELECT * FROM agent_deposit_settings WHERE owner_id=?').get(id);
 function snapshot(id){const base=global.snapshot();if(!id||id==='super')return base;const own=row(id);return {revision:own?.revision||0,baseRevision:base.revision,supportUrl:own?.support_url??base.supportUrl,channels:own?.channels?JSON.parse(own.channels):base.channels};}
 function owner(userId){const account=db.prepare('SELECT i.owner_id FROM creator_accounts a LEFT JOIN invitations i ON i.id=a.invite_id WHERE a.id=?').get(userId);if(!account)throw new AppError('账号不存在',404);return account.owner_id||'super';}
 function authorize(op){if(op.role==='super')return;if(!permissions.read(op.id).permissions.depositConfigure&&!permissions.read(op.id).permissions.supportConfigure)throw new AppError('充值渠道和客服配置权限未开通',403);}
 return {snapshot,forCustomer(id){const selected=owner(id);return row(selected)?snapshot(selected):global.snapshot();},resolve(userId,id,method){return resolveDepositChannel(snapshot(owner(userId)),id,method);},read(op){authorize(op);return snapshot(op.role==='super'?'super':op.id);},save(op,input){
  if(op.role==='super')return global.save(op.username,input);authorize(op);
  if(input.ownerId!==undefined||input.customerId!==undefined)throw new AppError('仅能配置本人归属客户',403);
  return store.audited(op.username,'agent.deposit.configure',op.id,()=>{
   const current=snapshot(op.id);if(input.revision!==current.revision||input.baseRevision!==current.baseRevision)throw new AppError('配置已更新，请重新读取后修改',409);
   const normalized=normalizeDepositSettings(input,current),changedChannels=JSON.stringify(normalized.channels)!==JSON.stringify(current.channels),changedSupport=normalized.supportUrl!==current.supportUrl;
   if(changedChannels)permissions.assert(op,'depositConfigure');if(changedSupport)permissions.assert(op,'supportConfigure');
   const previous=row(op.id);db.prepare('INSERT INTO agent_deposit_settings(owner_id,revision,channels,support_url) VALUES(?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET revision=excluded.revision,channels=excluded.channels,support_url=excluded.support_url').run(op.id,current.revision+1,changedChannels?JSON.stringify(normalized.channels):previous?.channels??null,changedSupport?normalized.supportUrl:previous?.support_url??null);
   return snapshot(op.id);
  });
 }};
}
