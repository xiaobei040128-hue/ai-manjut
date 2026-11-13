export function initializeAdminReviewNotices(db){db.exec("CREATE INDEX IF NOT EXISTS fund_requests_pending_notices ON fund_requests(created_at,id,user_id) WHERE kind='withdrawal' AND status='review'");}
// Alerts need only pending identifiers, never complete financial/customer data.
export function adminReviewNotices(db,operator){
 const own=operator.role==='super'?'':' AND EXISTS (SELECT 1 FROM creator_accounts a JOIN invitations i ON i.id=a.invite_id WHERE a.id=f.user_id AND i.owner_id=?)';
 return {requests:db.prepare("SELECT f.id,f.status,f.kind,f.created_at FROM fund_requests f WHERE f.kind='withdrawal' AND f.status='review'"+own+' ORDER BY f.created_at,f.id').all(...(own?[operator.id]:[]))};
}
