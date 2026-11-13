import {readFileSync} from 'node:fs';
import {AppError} from './store.mjs';
export const agentPermissionDefinitions=JSON.parse(readFileSync(new URL('../shared/agent-permissions.json',import.meta.url),'utf8'));
const defaults=()=>Object.fromEntries(agentPermissionDefinitions.map(d=>[d.id,d.defaultEnabled!==false]));
export function createAgentPermissions(store){const db=store.db;db.exec('CREATE TABLE IF NOT EXISTS agent_permissions(agent_id TEXT PRIMARY KEY,revision INTEGER NOT NULL,permissions TEXT NOT NULL)');
 const read=id=>{const row=db.prepare('SELECT * FROM agent_permissions WHERE agent_id=?').get(id);return {revision:row?.revision||0,permissions:row?{...defaults(),...JSON.parse(row.permissions)}:defaults()};};
 return {read,save(actor,id,input){if(!db.prepare('SELECT id FROM agent_admins WHERE id=?').get(id))throw new AppError('代理不存在',404);if(!input.permissions||typeof input.permissions!=='object'||Object.keys(input.permissions).length!==agentPermissionDefinitions.length||agentPermissionDefinitions.some(d=>typeof input.permissions[d.id]!=='boolean'))throw new AppError('权限配置不完整或包含无效权限');return store.audited(actor,'agent.permissions.update',id,()=>{const old=read(id);if(old.revision!==input.revision)throw new AppError('权限已变更，请重新读取',409);db.prepare('INSERT INTO agent_permissions VALUES(?,?,?) ON CONFLICT(agent_id) DO UPDATE SET revision=excluded.revision,permissions=excluded.permissions').run(id,old.revision+1,JSON.stringify(input.permissions));return read(id);},{permissions:input.permissions});},assert(op,key){if(op.role==='super')return;if(read(op.id).permissions[key]!==true)throw new AppError('此操作权限已关闭，请联系总后台',403);},key(path,method){
 if(path==='/api/export/ledger')return 'ledgerExport';
 if(method==='GET'&&/\/finance\/(identity|bank)\/[^/]+\/photos\//.test(path))return 'sensitiveReveal';
 if(['GET','HEAD'].includes(method))return null;
 if(path.startsWith('/api/admin/invitations'))return 'invitations';
 if(/\/accounts\/[^/]+\/(password|fund-password|revoke-sessions)$/.test(path))return 'customerSecurity';
 if(/\/accounts\/[^/]+\/(notes|customer-type|reputation)$/.test(path))return 'customerEdit';
 if(path==='/api/admin/early-stage-policy')return 'taskConfigure';
 if(/\/plan-dispatch\/|\/premium-dispatch\//.test(path))return 'taskConfigure';
 if(/\/stage-enrollments\/[^/]+\/review$/.test(path))return 'enrollmentReview';
 if(/\/activity-rewards\/[^/]+\/grant$/.test(path))return 'rewardGrant';
 const f=path.match(/\/finance\/(identity|bank|fund|account)\/([^/]+)\/(review|reveal|adjust|freeze)$/);if(f){if(f[3]==='reveal')return 'sensitiveReveal';if(f[3]==='adjust')return 'balanceAdjust';if(f[3]==='freeze')return 'accountFreeze';if(f[1]==='identity')return 'identityReview';if(f[1]==='bank')return 'payoutReview';if(f[1]==='fund'){const row=db.prepare('SELECT kind FROM fund_requests WHERE id=?').get(f[2]);return row?.kind==='withdrawal'?'withdrawalReview':'depositReview';}}
 if(/\/assignments\/[^/]+\/review$/.test(path))return 'taskConfigure';return null;
 }};
}
