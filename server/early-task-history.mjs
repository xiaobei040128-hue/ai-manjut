// Read existing milestones and orders without granting rewards or creating quotes.
export function earlyTaskHistory(db,userId) {
 const records=[];
 const add=(id,title,status,created_at,reward=0,amount=0,stage=1,artwork='')=>records.push({id,title,status,created_at,reward,amount,stage,artwork});
 const ledger=db.prepare('SELECT * FROM ledger WHERE owner_id=? ORDER BY created_at,id').all(userId);
 const registration=ledger.find(r=>r.kind==='registration_reward');
 if(registration)add('registration','注册成功','completed',registration.created_at,registration.amount);
 const identity=db.prepare('SELECT * FROM identities WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1').get(userId);
 if(identity)add('identity','完成实名认证',identity.status==='approved'?'completed':identity.status==='rejected'?'revision':'review',identity.created_at,ledger.find(r=>r.operation_key==='newcomer-identity:'+userId)?.amount||0);
 const cover=db.prepare('SELECT * FROM newcomer_cover_orders WHERE owner_id=?').get(userId);
 if(cover)add(cover.id,'购买版权封面',cover.state==='completed'?'completed':'active',cover.completed_at||cover.purchased_at||cover.created_at,cover.state==='completed'?cover.commission||0:0,cover.amount,1,JSON.parse(cover.artwork).title);
 const card=db.prepare("SELECT * FROM bank_cards WHERE user_id=? AND status='approved' ORDER BY created_at LIMIT 1").get(userId);
 if(card)add('payout-binding','绑定提款方式','completed',card.created_at);
 const withdrawal=db.prepare("SELECT * FROM fund_requests WHERE user_id=? AND kind='withdrawal' AND (newcomer_task=1 OR status='paid') ORDER BY created_at LIMIT 1").get(userId);
 if(withdrawal)add('first-withdrawal','首次提款申请','completed',withdrawal.created_at);
 const skipsExist=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='newcomer_withdrawal_skips'").get();
 const skipped=skipsExist?db.prepare('SELECT skipped_at FROM newcomer_withdrawal_skips WHERE owner_id=?').get(userId):null;
 if(skipped&&!withdrawal)add('first-withdrawal-skipped','已跳过首次提款','completed',skipped.skipped_at);
 const graduate=ledger.find(r=>r.operation_key==='newcomer-graduate:'+userId);
 if(graduate)add('graduation','新手毕业奖励','completed',graduate.created_at,graduate.amount);
 const progress=db.prepare('SELECT * FROM community_progress WHERE owner_id=?').get(userId);
 const titles=['认识 AI 漫剧','写下你的感受','填写喜欢的漫剧题材'];
 for(let step=0;step<3;step++){
  const reward=ledger.find(r=>r.operation_key===`community-task:${userId}:${step}`);
  if(reward)add('community-'+step,titles[step],'completed',reward.created_at,reward.amount,0,2);
  else if(progress&&progress.completed===step&&progress.revealed===step)add('community-'+step,titles[step],'active',null,0,0,2);
 }
 for(const order of db.prepare('SELECT * FROM community_license_orders WHERE owner_id=? ORDER BY step').all(userId)){
  const reward=ledger.find(r=>r.operation_key==='community-reward:'+order.id);
  add(order.id,'购买单集版权',order.state==='completed'?'completed':'active',reward?.created_at||order.created_at,order.state==='completed'?order.commission:0,order.amount,2,JSON.parse(order.artwork).title);
 }
 return records;
}
