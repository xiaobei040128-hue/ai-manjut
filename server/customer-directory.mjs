export function customerDirectory(store, auth, scope, operator) {
  const db = store.db,
    rows = scope.filterUsers(operator, auth.users());
  // Only approved display fields are selected; no document numbers, photos or hashes.
  const record =
    db.prepare(`SELECT a.frozen,a.freeze_reason,i.code AS invite_code,i.label AS invite_label,i.owner_id AS agent_id,
    CASE WHEN i.owner_id='super' THEN '总后台' ELSE COALESCE(g.username,'已停用代理') END AS agent_username,
    (SELECT status FROM identities WHERE user_id=a.id ORDER BY created_at DESC,rowid DESC LIMIT 1) AS identity_status,
    (SELECT COUNT(*) FROM bank_cards WHERE user_id=a.id AND status='approved') AS approved_cards,
    (SELECT COUNT(*) FROM fund_requests WHERE user_id=a.id AND status='review') AS pending_funds,
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
    return {
      ...row,
      ...fields,
      identity_status: extra.identity_status || "not_submitted",
      wallet: {
        ...row.wallet,
        held: task_held + withdrawal_held,
        taskHeld: task_held,
        withdrawalHeld: withdrawal_held,
        total: row.wallet.available + task_held + withdrawal_held,
      },
    };
  });
}
