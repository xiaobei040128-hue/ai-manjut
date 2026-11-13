import {customerJourneyProgress} from './customer-journey-progress.mjs';
import {AppError} from './store.mjs';
export function customerDirectory(store, auth, scope, operator, customerType='all', customerId) {
  if (!['all','real','test'].includes(customerType)) throw new AppError('无效客户类型筛选');
  if(customerId!==undefined&&(typeof customerId!=='string'||!customerId))throw new AppError('无效客户范围');
  let owners;
  if(customerId!==undefined){scope.assertUser(operator,customerId);owners=[customerId];}
  else{const allowed=scope.users(operator);owners=allowed?[...allowed]:undefined;}
  const db=store.db,rows=auth.users(owners).filter(row=>customerType==='all'||row.customer_type===customerType);
  const held=table=>db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)?db.prepare('SELECT COALESCE(SUM(amount),0) n FROM '+table+' WHERE owner_id=? AND state=?'):null;
  const cover=held('newcomer_cover_orders'),reserved=held('task_balance_reservations'),episode=held('community_license_orders');
  // Only approved display fields are selected; no document numbers, photos or hashes.
  const record =
    db.prepare(`SELECT a.frozen,a.freeze_reason,i.code AS invite_code,i.label AS invite_label,i.owner_id AS agent_id,
    CASE WHEN i.owner_id='super' THEN '总后台' ELSE COALESCE(g.username,'已停用代理') END AS agent_username,
    COALESCE(NULLIF(g.name,''),g.username,'总后台') AS agent_name,
    (SELECT status FROM identities WHERE user_id=a.id ORDER BY created_at DESC,rowid DESC LIMIT 1) AS identity_status,
    (SELECT COUNT(*) FROM bank_cards WHERE user_id=a.id AND status='approved') AS approved_cards,
    (SELECT COUNT(*) FROM fund_requests WHERE user_id=a.id AND status='review') AS pending_funds,
    (SELECT COUNT(*) FROM fund_requests WHERE user_id=a.id AND kind='deposit' AND status='review') AS pending_deposits,
    (SELECT COUNT(*) FROM fund_requests WHERE user_id=a.id AND kind='withdrawal' AND status IN ('review','paying')) AS pending_withdrawals,
    (SELECT COUNT(*) FROM bank_cards WHERE user_id=a.id AND status='review') AS pending_cards,
    (SELECT COUNT(*) FROM creator_sessions WHERE user_id=a.id AND expires_at>?) AS session_count,
    (SELECT COALESCE(SUM(COALESCE(f.amount,t.deposit)),0) FROM assignments x JOIN tasks t ON t.id=x.task_id LEFT JOIN assignment_terms f ON f.assignment_id=x.id WHERE x.owner_id=a.id AND x.status IN ('active','review','revision')) AS task_held,
    (SELECT COALESCE(SUM(amount),0) FROM fund_requests WHERE user_id=a.id AND kind='withdrawal' AND status IN ('review','paying')) AS withdrawal_held,
    (SELECT COALESCE(SUM(amount),0) FROM fund_requests WHERE user_id=a.id AND kind='deposit' AND status='completed') AS deposited,
    (SELECT COALESCE(SUM(amount),0) FROM fund_requests WHERE user_id=a.id AND kind='withdrawal' AND status='paid') AS withdrawn
    FROM creator_accounts a LEFT JOIN invitations i ON i.id=a.invite_id LEFT JOIN agent_admins g ON g.id=i.owner_id WHERE a.id=?`);
  const now = new Date().toISOString();
  return rows.map((row) => {
    const extra = record.get(now, row.id);
    const { task_held, withdrawal_held, ...fields } = extra;
    const coverHeld=cover?.get(row.id,'purchased').n||0;
    const reservedHeld=reserved?.get(row.id,'reserved').n||0;
    const episodeHeld=episode?.get(row.id,'purchased').n||0;
    return {
      ...row,
      progress:customerJourneyProgress(db,row.id),
      ...fields,
      identity_status: extra.identity_status || "not_submitted",
      wallet: {
        ...row.wallet,
        held: task_held + withdrawal_held + coverHeld + episodeHeld + reservedHeld,
        taskHeld: task_held + coverHeld + episodeHeld + reservedHeld,
        withdrawalHeld: withdrawal_held,
        total: row.wallet.available + task_held + withdrawal_held + coverHeld + episodeHeld + reservedHeld,
      },
    };
  });
}
