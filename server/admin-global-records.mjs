import {AppError} from './store.mjs';

const initialized=new WeakSet();

export function adminGlobalRecords(store,operator,input){
 const db=store.db,ledger=input.view==='ledger',agent=operator.role!=='super';
 const page=Number(input.page||1),query=(input.q||'').trim().toLowerCase(),kind=input.kind||'all';
 if(!Number.isSafeInteger(page)||page<1||page>1e8||query.length>200||kind.length>80)throw new AppError('筛选条件无效');
 if(!initialized.has(db)){
  db.function('admin_record_lower',{deterministic:true},value=>String(value??'').toLowerCase());
  initialized.add(db);
 }
 const table=ledger?'ledger':'admin_audit',clauses=[],args=[];
 if(agent){
  clauses.push(ledger?'EXISTS (SELECT 1 FROM creator_accounts c JOIN invitations i ON i.id=c.invite_id WHERE c.id=r.owner_id AND i.owner_id=?)':'r.actor=?');
  args.push(ledger?operator.id:operator.username);
 }
 const scope=clauses.length?' WHERE '+clauses.join(' AND '):'';
 const scopeArgs=[...args];
 if(ledger&&kind!=='all'){clauses.push('r.kind=?');args.push(kind);}
 if(query){
  let matches;
  try{
   matches=JSON.parse(input.matches||'[]');
   if(!Array.isArray(matches)||matches.length>300||matches.some(key=>typeof key!=='string'||key.length>100))throw Error();
  }catch{throw new AppError('筛选条件无效');}
  const field=ledger?'kind':'action';
  const columns=ledger?"r.note||' '||r.id||' '||r.kind":"r.action||' '||r.actor||' '||r.target";
  clauses.push('('+('instr(admin_record_lower('+columns+'),?)>0')+' OR r.'+field+' IN (SELECT value FROM json_each(?)))');
  args.push(query,JSON.stringify(matches));
 }
 const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
 const total=db.prepare('SELECT COUNT(*) n FROM '+table+' r'+where).get(...args).n;
 const currentPage=Math.min(page,Math.max(1,Math.ceil(total/10)));
 const rows=db.prepare('SELECT r.* FROM '+table+' r'+where+' ORDER BY r.id DESC LIMIT 10 OFFSET ?').all(...args,(currentPage-1)*10);
 if(!ledger)return {audit:rows.map(row=>({...row,detail:parseAuditDetail(row.detail)})),ledger:[],assignments:[],creators:[],recordTotal:total,recordPage:currentPage};
 const owners=agent?db.prepare('SELECT c.id FROM creator_accounts c JOIN invitations i ON i.id=c.invite_id WHERE i.owner_id=?').all(operator.id).map(row=>row.id):undefined;
 const summary=store.summary({owners,taskView:true,assignmentIds:[]});
 const ids=[...new Set(rows.map(row=>row.assignment_id).filter(Boolean))];
 const assignments=ids.flatMap(id=>{
  const row=db.prepare('SELECT owner_id FROM assignments WHERE id=?').get(id);
  if(!row||(owners&&!owners.includes(row.owner_id)))return [];
  return [store.asUser(row.owner_id,()=>store.assignment(id))];
 });
 const creators=db.prepare('SELECT a.id,a.email,p.name FROM creator_accounts a JOIN creator_profiles p ON p.user_id=a.id WHERE a.id IN (SELECT value FROM json_each(?))').all(JSON.stringify([...new Set([...rows.map(r=>r.owner_id),...assignments.map(a=>a.owner_id)])]));
 return {ledger:rows,audit:[],assignments,creators,profile:{name:'历史工作区'},wallet:summary.wallet,recordTotal:total,recordPage:currentPage,ledgerTotal:db.prepare('SELECT COUNT(*) n FROM ledger r'+scope).get(...scopeArgs).n};
}

function parseAuditDetail(value){
 try{return JSON.parse(value)||{};}catch{return {};}
}
