import {generateInviteCode,migrateInviteCodes} from './invite-codes.mjs';
import {initializeReferrals,personalInviter,bindNewReferral,personalInvite} from './referrals.mjs';
import {createAttemptLimit,attemptAddress} from './attempt-limit.mjs';
import {
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { AppError } from "./store.mjs";
import { clientMetadata } from "./client-metadata.mjs";
import { locateCountry } from "./geo-country.mjs";
const derive = promisify(scrypt),
  digest = (v) => createHash("sha256").update(v).digest("hex");
export function createCreatorAuth(store, port) {
  const db = store.db,
    name = "drama_creator_" + port,
    attempts = createAttemptLimit({max:10}),
    duration = 7 * 86400;
  db.exec(`CREATE TABLE IF NOT EXISTS creator_accounts(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,salt TEXT NOT NULL,created_at TEXT NOT NULL,invite_id TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS creator_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES creator_accounts(id),expires_at TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS invitations(id TEXT PRIMARY KEY,code_hash TEXT UNIQUE NOT NULL,hint TEXT NOT NULL,label TEXT NOT NULL,max_uses INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0,expires_at TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS creator_sessions_user ON creator_sessions(user_id);`);
  const customerColumns = new Set(
    db
      .prepare("PRAGMA table_info(creator_accounts)")
      .all()
      .map((c) => c.name),
  );
  for (const column of [
    "country",
    "registration_ip",
    "last_login_ip",
    "last_login_at",
    "last_login_agent",
    "admin_note",
    "country_source",
    "registration_country",
    "last_login_country",
  ])
    if (!customerColumns.has(column))
      db.exec(
        `ALTER TABLE creator_accounts ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`,
      );
  if (!customerColumns.has('reputation_score')) db.exec('ALTER TABLE creator_accounts ADD COLUMN reputation_score INTEGER NOT NULL DEFAULT 100 CHECK(reputation_score BETWEEN 0 AND 100)');
  if (!customerColumns.has('customer_type'))
    db.exec("ALTER TABLE creator_accounts ADD COLUMN customer_type TEXT NOT NULL DEFAULT 'real' CHECK(customer_type IN ('real','test'))");
  if (!customerColumns.has('username')) db.exec('ALTER TABLE creator_accounts ADD COLUMN username TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS creator_username_unique ON creator_accounts(username COLLATE NOCASE) WHERE username IS NOT NULL');
  // Replace only the exact historical generated default; preserve custom names.
  db.prepare("UPDATE creator_profiles SET name='User '||upper(substr(user_id,1,4)) WHERE name='创作者 '||substr(user_id,1,4)").run();
  function recordAccess(req, id, registration = false) {
    const { ip, agent } = clientMetadata(req),
      now = new Date().toISOString(),
      geo = locateCountry(ip);
    db.prepare(
      "UPDATE creator_accounts SET last_login_ip=?,last_login_at=?,last_login_agent=?,country=?,last_login_country=?,country_source=? WHERE id=?",
    ).run(ip, now, agent, geo.country, geo.country, geo.source, id);
    if (registration)
      db.prepare(
        "UPDATE creator_accounts SET registration_ip=?,registration_country=? WHERE id=?",
      ).run(ip, geo.country, id);
    return geo.country;
  }
  for (const [column, definition] of [
    ["owner_id", "TEXT NOT NULL DEFAULT 'super'"],
    ["code", "TEXT NOT NULL DEFAULT ''"],
  ])
    if (
      !db
        .prepare("PRAGMA table_info(invitations)")
        .all()
        .some((c) => c.name === column)
    )
      db.exec(
        "ALTER TABLE invitations ADD COLUMN " + column + " " + definition,
      );
  const token = (req) =>
    String(req.headers.cookie || "")
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(name + "="))
      ?.slice(name.length + 1) || "";
  initializeReferrals(db);
  migrateInviteCodes(db);
  const safe = (row) =>
    row
      ? {
          id: row.id,
          email: row.email,
          username: row.username || null,
          reputation_score: row.reputation_score ?? 100,
          created_at: row.created_at,
          emailVerified: false,
          phone: row.email.startsWith('+')?row.email:null,
          phoneVerified: false,
          country: row.country || "",
          frozen: !!row.frozen,
          freeze_reason: row.freeze_reason || "",
        }
      : null;
  function current(req) {
    const t = token(req);
    if (!/^[a-f0-9]{64}$/.test(t)) return null;
    return safe(
      db
        .prepare(
          "SELECT a.* FROM creator_sessions s JOIN creator_accounts a ON a.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
        )
        .get(digest(t), new Date().toISOString()),
    );
  }
  function limited(req) { attempts.hit(attemptAddress(req)); }
  function loginContact(value) {
    if(value.includes('@'))return value.toLowerCase();
    const phone=value.replace(/[\s().-]/g,'');
    return /^\+[1-9]\d{6,14}$/.test(phone)?phone:value;
  }
  function credentials(input, login = false) {
    const raw=typeof input.account==='string'?input.account:typeof input.email==='string'?input.email:'';
    const value=raw.trim(),password=typeof input.password==='string'?input.password:'';
    let email;
    if(login){if(!value||value.length>254)throw new AppError('账号或密码不正确',401);email=loginContact(value);}
    else if(value.includes('@')){email=value.toLowerCase();if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new AppError('请输入有效的邮箱地址');}
    else{email=value.replace(/[\s().-]/g,'');if(!/^\+[1-9]\d{6,14}$/.test(email))throw new AppError('请输入包含国际区号的有效手机号');}
    if (password.length < 8 || password.length > 128)
      throw new AppError("密码需为 8–128 位字符");
    return { email, password, value };
  }
  function session(userId) {
    const value = randomBytes(32).toString("hex"),
      now = new Date().toISOString();
    db.prepare("DELETE FROM creator_sessions WHERE expires_at<=?").run(now);
    db.prepare("INSERT INTO creator_sessions VALUES(?,?,?,?)").run(
      digest(value),
      userId,
      new Date(Date.now() + duration * 1000).toISOString(),
      now,
    );
    db.prepare(
      "DELETE FROM creator_sessions WHERE user_id=? AND token_hash IN (SELECT token_hash FROM creator_sessions WHERE user_id=? ORDER BY created_at DESC LIMIT -1 OFFSET 10)",
    ).run(userId, userId);
    return value;
  }
  return {
    current,
    require(req) {
      const user = current(req);
      if (!user) throw new AppError("请先登录创作者账号", 401);
      if (user.frozen) throw new AppError("账号已冻结，请联系管理员", 403);
      return user;
    },
    cookie(value) {
      return `${name}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${value ? duration : 0}${process.env.DRAMA_COOKIE_SECURE==='1'?'; Secure':''}`;
    },
    async register(req, input) {
      limited(req);
      const username=typeof input.username==='string'?input.username.trim():null;
      if(username!==null&&(!username||username.length>254||/[\p{Cc}]/u.test(username)))throw new AppError('请输入有效的用户名');
      const { email, password } = credentials(input),
        code =
          typeof input.inviteCode === "string"
            ? input.inviteCode.trim().toUpperCase()
            : "";
      if (!/^(?:[A-Z0-9]{6}|[A-Z0-9-]{8,40})$/.test(code))
        throw new AppError("请输入有效的邀请码");
      const salt = randomBytes(16).toString("hex"),
        hash = (await derive(password, salt, 64)).toString("hex");
      return store.audited("creator", "creator.register", "", () => {
        const inviter=personalInviter(db,code);
        if(inviter?.frozen)throw new AppError('邀请人账号已停用',400);
        const invite = inviter?db.prepare('SELECT * FROM invitations WHERE id=?').get(inviter.invite_id):db.prepare("SELECT * FROM invitations WHERE code_hash=? OR id=(SELECT target_id FROM invite_code_aliases WHERE code IN (?,?) AND kind='admin')").get(digest(code),code,'hash:'+digest(code));
        if (!invite || !invite.active)
          throw new AppError("邀请码无效、已过期或已用完", 400);
        if (
          invite.owner_id !== "super" &&
          (!db
            .prepare("SELECT name FROM sqlite_master WHERE name='agent_admins'")
            .get() ||
            !db
              .prepare("SELECT id FROM agent_admins WHERE id=? AND active=1")
              .get(invite.owner_id))
        )
          throw new AppError("邀请码所属后台已停用", 400);
        if (
          db.prepare("SELECT id FROM creator_accounts WHERE email=?").get(email)
        )
          throw new AppError("该账号已注册，请直接登录", 409);
        const usernameTaken=db.prepare('SELECT id FROM creator_accounts WHERE username=? COLLATE NOCASE');
        const contactTaken=db.prepare('SELECT id FROM creator_accounts WHERE email=?');
        if(usernameTaken.get(email)||db.prepare("SELECT username FROM creator_accounts WHERE username LIKE '%+%' OR username LIKE '%@%'").all().some(row=>loginContact(row.username)===email))
          throw new AppError('\u8be5\u8d26\u53f7\u5df2\u6ce8\u518c\uff0c\u8bf7\u76f4\u63a5\u767b\u5f55',409);
        if(username&&(usernameTaken.get(username)||contactTaken.get(loginContact(username))))
          throw new AppError('\u7528\u6237\u540d\u5df2\u88ab\u4f7f\u7528',409);
        const id = randomUUID(),
          created = new Date().toISOString();
        db.prepare(
          "INSERT INTO creator_accounts(id,email,password_hash,salt,created_at,invite_id) VALUES(?,?,?,?,?,?)",
        ).run(id, email, hash, salt, created, invite.id);
        if(username)db.prepare('UPDATE creator_accounts SET username=? WHERE id=?').run(username,id);
        if(inviter)bindNewReferral(db,id,inviter.id);
        personalInvite(db,id);
        const country = recordAccess(req, id, true);
        db.prepare("INSERT INTO creator_profiles VALUES(?,?,?,?,?)").run(
          id,
          username || "User " + id.slice(0, 4).toUpperCase(),
          "让好故事被更多人看见。",
          "",
          created,
        );
        db.prepare("UPDATE invitations SET used=used+1 WHERE id=?").run(
          invite.id,
        );
        return {
          user: {
            id,
            email,
            username,
            created_at: created,
            emailVerified: false,
            reputation_score: 100,
            country,
          },
          token: session(id),
        };
      });
    },
    async login(req, input) {
      limited(req);
      const { email, password, value } = credentials(input, true),
        row = db
          .prepare("SELECT * FROM creator_accounts WHERE email=? OR username=? COLLATE NOCASE")
          .get(email,value);
      const hash = await derive(
        password,
        row?.salt || "unknown-account-salt",
        64,
      );
      if (!row || !timingSafeEqual(hash, Buffer.from(row.password_hash, "hex")))
        throw new AppError("账号或密码不正确", 401);
      if (
        db
          .prepare("PRAGMA table_info(creator_accounts)")
          .all()
          .some((c) => c.name === "frozen") &&
        db.prepare("SELECT frozen FROM creator_accounts WHERE id=?").get(row.id)
          .frozen
      )
        throw new AppError("账号已冻结，请联系管理员", 403);
      return store.audited("creator", "creator.login", row.id, () => {
        // Password hashing is asynchronous. A reset during that await must not
        // authorize a new session using credentials that have already changed.
        const live=db.prepare('SELECT * FROM creator_accounts WHERE id=?').get(row.id);
        if(!live||live.password_hash!==row.password_hash||live.salt!==row.salt)throw new AppError('账号或密码已变更，请重新登录',401);
        if(live.frozen)throw new AppError('账号已冻结，请联系管理员',403);
        live.country = recordAccess(req, live.id);
        return { user: safe(live), token: session(live.id) };
      });
    },
    async changeOwnPassword(req,input) {
      const user=this.require(req);
      limited(req);
      const row=db.prepare('SELECT email,password_hash,salt FROM creator_accounts WHERE id=?').get(user.id);
      const currentPassword=typeof input.currentPassword==='string'?input.currentPassword:'';
      if(!currentPassword||currentPassword.length>128)throw new AppError('请输入当前密码');
      const password=credentials({email:row.email,password:input.newPassword}).password;
      if(password!==input.confirmPassword)throw new AppError('两次输入的新密码不一致');
      if(password===currentPassword)throw new AppError('新密码不能与当前密码相同');
      const check=await derive(currentPassword,row.salt,64);
      if(!timingSafeEqual(check,Buffer.from(row.password_hash,'hex')))throw new AppError('当前密码不正确',400);
      const salt=randomBytes(16).toString('hex'),hash=(await derive(password,salt,64)).toString('hex');
      return store.audited(user.id,'creator.password_change',user.id,()=>{
        const live=current(req);if(!live||live.id!==user.id)throw new AppError('登录已过期，请重新登录',401);
        const changed=db.prepare('UPDATE creator_accounts SET password_hash=?,salt=? WHERE id=? AND password_hash=?').run(hash,salt,user.id,row.password_hash);
        if(!changed.changes)throw new AppError('密码已变更，请重新登录后操作',409);
        db.prepare('DELETE FROM creator_sessions WHERE user_id=?').run(user.id);
        return {ok:true};
      });
    },
    async updatePassword(actor,id,input,authorize) {
      const row=db.prepare('SELECT email FROM creator_accounts WHERE id=?').get(id);
      if(!row)throw new AppError('客户不存在',404);
      const temporary=input.mode==='reset';
      if(!temporary&&input.mode!=='change')throw new AppError('请选择修改或重置密码');
      const password=temporary?randomBytes(15).toString('base64url'):input.password;
      credentials({email:row.email,password});
      const salt=randomBytes(16).toString('hex'),hash=(await derive(password,salt,64)).toString('hex');
      return store.audited(actor,'customer.password_reset',id,()=>{
        if(authorize)authorize();
        db.prepare('UPDATE creator_accounts SET password_hash=?,salt=? WHERE id=?').run(hash,salt,id);
        const revoked=db.prepare('DELETE FROM creator_sessions WHERE user_id=?').run(id).changes;
        return {ok:true,revoked,...(temporary?{temporaryPassword:password}:{})};
      },{mode:input.mode});
    },
    updateCustomerType(actor, id, input) {
      if (!['real','test'].includes(input.customerType)) throw new AppError('请选择真实客户或测试账号');
      const previous = db.prepare('SELECT customer_type FROM creator_accounts WHERE id=?').get(id);
      if (!previous) throw new AppError('客户不存在',404);
      return store.audited(actor,'customer.type',id,()=>{
        const current=db.prepare('SELECT customer_type FROM creator_accounts WHERE id=?').get(id);
        if(input.expectedCustomerType!==undefined&&input.expectedCustomerType!==current.customer_type)throw new AppError('客户类型已被其他页面修改，请刷新后重新核对',409);
        db.prepare('UPDATE creator_accounts SET customer_type=? WHERE id=?').run(input.customerType,id);
        return {ok:true,customerType:input.customerType};
      },{before:previous.customer_type,after:input.customerType});
    },
    updateNote(actor, id, input) {
      if (typeof input.note !== "string" || input.note.length > 1000)
        throw new AppError("内部备注不超过 1000 字");
      return store.audited(actor, "customer.note", id, () => {
        const current=db.prepare('SELECT admin_note FROM creator_accounts WHERE id=?').get(id);
        if(current&&input.expectedNote!==undefined&&input.expectedNote!==current.admin_note)throw new AppError('客户备注已被其他页面修改，请刷新后重新核对',409);
        const result = db
          .prepare("UPDATE creator_accounts SET admin_note=? WHERE id=?")
          .run(input.note.trim(), id);
        if (!result.changes) throw new AppError("客户不存在", 404);
        return { ok: true };
      });
    },
    revokeSessions(actor, id) {
      if (!db.prepare("SELECT id FROM creator_accounts WHERE id=?").get(id))
        throw new AppError("客户不存在", 404);
      return store.audited(actor, "customer.sessions_revoke", id, () => {
        const result = db
          .prepare("DELETE FROM creator_sessions WHERE user_id=?")
          .run(id);
        return { ok: true, revoked: result.changes };
      });
    },
    logout(req) {
      const value = token(req);
      if (value)
        db.prepare("DELETE FROM creator_sessions WHERE token_hash=?").run(
          digest(value),
        );
    },
    invitations(ownerId) {
      const agents=db.prepare("SELECT name FROM sqlite_master WHERE name='agent_admins'").get()?new Map(db.prepare('SELECT id,username,name FROM agent_admins').all().map(a=>[a.id,a])):new Map();
      return db
        .prepare(
          "SELECT id,hint,code,label,used,active,created_at,owner_id FROM invitations" +
            (ownerId ? " WHERE owner_id=?" : "") +
            " ORDER BY created_at DESC",
        )
        .all(...(ownerId ? [ownerId] : [])).map(i=>({...i,owner_name:agents.get(i.owner_id)?.name||'',owner_username:agents.get(i.owner_id)?.username||''}));
    },
    createInvite(actor, input, ownerId = "super") {
      const label = String(input.label || "创作者邀请")
          .trim()
          .slice(0, 80),
        code = generateInviteCode(db);
      const id = randomUUID();
      return store.audited(actor, "invite.create", id, () => {
        db.prepare(
          "INSERT INTO invitations(id,code_hash,hint,code,label,max_uses,expires_at,created_at,owner_id) VALUES(?,?,?,?,?,2147483647,?,?,?)",
        ).run(
          id,
          digest(code),
          code.slice(-4),
          code,
          label,
          "9999-12-31T23:59:59.999Z",
          new Date().toISOString(),
          ownerId,
        );
        return { id, code };
      });
    },
    revoke(actor, id) {
      return store.audited(actor, "invite.revoke", id, () => {
        const r = db
          .prepare("UPDATE invitations SET active=0 WHERE id=?")
          .run(id);
        if (!r.changes) throw new AppError("邀请码不存在", 404);
        return { ok: true };
      });
    },
    users(owners) {
      if(owners!==undefined&&(!Array.isArray(owners)||owners.some(id=>typeof id!=="string"||!id)))throw new AppError("无效客户范围");
      return db
        .prepare(
          `SELECT a.id,a.email,a.reputation_score,a.created_at,a.country,a.registration_ip,a.last_login_ip,a.last_login_at,a.last_login_agent,a.admin_note,a.customer_type,a.country_source,a.registration_country,a.last_login_country,a.invite_id,p.name,p.bio,p.channel,
   (SELECT COUNT(*) FROM assignments WHERE owner_id=a.id) AS assignmentCount,
   (SELECT COUNT(*) FROM assignments WHERE owner_id=a.id AND status IN ('active','revision')) AS active,
   (SELECT COUNT(*) FROM assignments WHERE owner_id=a.id AND status='review') AS review,
   (SELECT COUNT(*) FROM assignments WHERE owner_id=a.id AND status='completed') AS completed,
   (SELECT COALESCE(SUM(amount),0) FROM ledger WHERE owner_id=a.id) AS available,
   (SELECT COALESCE(SUM(amount),0) FROM ledger WHERE owner_id=a.id AND kind='reward') AS earned
   FROM creator_accounts a JOIN creator_profiles p ON p.user_id=a.id ${owners===undefined?'':'WHERE a.id IN (SELECT value FROM json_each(?))'} ORDER BY a.created_at DESC`,
        )
        .all(...(owners===undefined?[]:[JSON.stringify(owners)]))
        .map(({ active, review, completed, available, earned, ...u }) => ({
          ...u,
          emailVerified: false,
          counts: { active, review, completed },
          wallet: { available, earned },
        }));
    },
  };
}
