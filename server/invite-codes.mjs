import {randomInt,createHash} from 'node:crypto';
const digest=value=>createHash('sha256').update(value).digest('hex');
export function inviteAliases(db){db.exec(`CREATE TABLE IF NOT EXISTS invite_code_aliases(code TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('personal','admin')),target_id TEXT NOT NULL);`);}
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const mixedCode=/^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{6}$/;
export function generateInviteCode(db){
 inviteAliases(db);
 for(let attempt=0;attempt<10000;attempt++){
  const code=Array.from({length:6},()=>alphabet[randomInt(alphabet.length)]).join('');
  if(!mixedCode.test(code))continue;
  if(!db.prepare('SELECT 1 FROM personal_invites WHERE code=?').get(code)&&!db.prepare('SELECT 1 FROM invitations WHERE code_hash=?').get(digest(code))&&!db.prepare('SELECT 1 FROM invite_code_aliases WHERE code IN (?,?)').get(code,'hash:'+digest(code)))return code;
 }
 throw new Error('Invitation code allocation exhausted');
}
export function migrateInviteCodes(db){
 inviteAliases(db);db.exec('BEGIN IMMEDIATE');
 try{
  for(const row of db.prepare('SELECT user_id,code FROM personal_invites').all())if(!mixedCode.test(row.code??'')){
   const code=generateInviteCode(db);db.prepare("INSERT OR IGNORE INTO invite_code_aliases VALUES(?,'personal',?)").run(row.code.toUpperCase(),row.user_id);db.prepare('UPDATE personal_invites SET code=? WHERE user_id=?').run(code,row.user_id);
  }
  for(const row of db.prepare('SELECT id,code,code_hash FROM invitations').all())if(!mixedCode.test(row.code??'')){
   const code=generateInviteCode(db);
   db.prepare("INSERT OR IGNORE INTO invite_code_aliases VALUES(?,'admin',?)").run('hash:'+row.code_hash,row.id);
   if(row.code)db.prepare("INSERT OR IGNORE INTO invite_code_aliases VALUES(?,'admin',?)").run(row.code.toUpperCase(),row.id);
   db.prepare('UPDATE invitations SET code=?,code_hash=?,hint=? WHERE id=?').run(code,digest(code),code.slice(-4),row.id);
  }
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
}
