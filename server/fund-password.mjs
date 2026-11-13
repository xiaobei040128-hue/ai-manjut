import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {AppError} from './store.mjs';
export function createFundPassword(store){
 const db=store.db;
 db.exec(`CREATE TABLE IF NOT EXISTS fund_passwords(user_id TEXT PRIMARY KEY REFERENCES creator_accounts(id),password_hash TEXT NOT NULL,salt TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS fund_password_attempts(user_id TEXT PRIMARY KEY,failures INTEGER NOT NULL DEFAULT 0,locked_until INTEGER NOT NULL DEFAULT 0);`);
 const state=id=>({configured:!!db.prepare('SELECT 1 FROM fund_passwords WHERE user_id=?').get(id)});
 function active(id){const row=db.prepare('SELECT * FROM creator_accounts WHERE id=?').get(id);if(!row)throw new AppError('请先登录',401);if(row.frozen)throw new AppError('账号已冻结',403);return row;}
 function checkLock(id){const row=db.prepare('SELECT * FROM fund_password_attempts WHERE user_id=?').get(id);if(row?.locked_until>Date.now())throw new AppError('资金密码尝试过多，请15分钟后重试',429);if(row?.locked_until&&row.locked_until<=Date.now())db.prepare('DELETE FROM fund_password_attempts WHERE user_id=?').run(id);}
 function fail(id){db.prepare('INSERT INTO fund_password_attempts(user_id,failures) VALUES(?,1) ON CONFLICT(user_id) DO UPDATE SET failures=failures+1').run(id);db.prepare('UPDATE fund_password_attempts SET locked_until=? WHERE user_id=? AND failures>=5').run(Date.now()+900000,id);throw new AppError('资金密码或验证密码不正确',400);}
 function matches(value,row){return typeof value==='string'&&value.length<=128&&timingSafeEqual(scryptSync(value,row.salt,64),Buffer.from(row.password_hash,'hex'));}
 function verify(id,password){active(id);checkLock(id);const row=db.prepare('SELECT * FROM fund_passwords WHERE user_id=?').get(id);if(!row)throw new AppError('请先设置资金密码',409);if(!matches(password,row))fail(id);db.prepare('DELETE FROM fund_password_attempts WHERE user_id=?').run(id);return true;}
 function save(id,input){const account=active(id);checkLock(id);const old=db.prepare('SELECT * FROM fund_passwords WHERE user_id=?').get(id);const value=input.newPassword;if(typeof value!=='string'||!/^\d{6}$/.test(value))throw new AppError('资金密码需为6位数字');if(value!==input.confirmPassword)throw new AppError('两次输入的资金密码不一致');if(matches(value,account))throw new AppError('资金密码不能与登录密码相同');if(old){verify(id,input.currentPassword);}else if(!matches(input.loginPassword,account))fail(id);
 const salt=randomBytes(16).toString('hex'),hash=scryptSync(value,salt,64).toString('hex');
 return store.audited(id,old?'fund_password.change':'fund_password.setup',id,()=>{db.prepare('INSERT INTO fund_passwords VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET password_hash=excluded.password_hash,salt=excluded.salt,updated_at=excluded.updated_at').run(id,hash,salt,new Date().toISOString());db.prepare('DELETE FROM fund_password_attempts WHERE user_id=?').run(id);return {ok:true,configured:true};});
 }
 function adminState(operator,id,scope){scope.assertUser(operator,id);if(!db.prepare('SELECT id FROM creator_accounts WHERE id=?').get(id))throw new AppError('客户不存在',404);const row=db.prepare('SELECT updated_at FROM fund_passwords WHERE user_id=?').get(id);return {configured:!!row,updatedAt:row?.updated_at||null};}
 function reset(operator,id,input,scope){
  adminState(operator,id,scope);if(input.confirmed!==true)throw new AppError('请确认重设客户资金密码');
  const value=input.newPassword,account=db.prepare('SELECT * FROM creator_accounts WHERE id=?').get(id);
  if(typeof value!=='string'||!/^\d{6}$/.test(value))throw new AppError('资金密码需为6位数字');
  if(value!==input.confirmPassword)throw new AppError('两次输入的资金密码不一致');
  if(matches(value,account))throw new AppError('资金密码不能与登录密码相同');
  const salt=randomBytes(16).toString('hex'),hash=scryptSync(value,salt,64).toString('hex');
  return store.audited(operator.username,'customer.fund_password_reset',id,()=>{db.prepare('INSERT INTO fund_passwords VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET password_hash=excluded.password_hash,salt=excluded.salt,updated_at=excluded.updated_at').run(id,hash,salt,new Date().toISOString());db.prepare('DELETE FROM fund_password_attempts WHERE user_id=?').run(id);return {ok:true,...adminState(operator,id,scope)};});
 }
 return {state,verify,save,adminState,reset};
}
