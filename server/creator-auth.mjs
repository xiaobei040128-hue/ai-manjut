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
    attempts = new Map(),
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
  const safe = (row) =>
    row
      ? {
          id: row.id,
          email: row.email,
          created_at: row.created_at,
          emailVerified: false,
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
  function limited(req) {
    const key = req.socket.remoteAddress || "local",
      old = attempts.get(key),
      now = Date.now();
    if (old && old.until > now && old.count >= 10)
      throw new AppError("尝试过于频繁，请稍后再试", 429);
    const next =
      old && old.until > now ? old : { count: 0, until: now + 60000 };
    next.count++;
    attempts.set(key, next);
    if (attempts.size > 1000)
      for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k);
  }
  function credentials(input) {
    const email =
        typeof input.email === "string" ? input.email.trim().toLowerCase() : "",
      password = typeof input.password === "string" ? input.password : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new AppError("请输入有效的邮箱地址");
    if (password.length < 8 || password.length > 128)
      throw new AppError("密码需为 8–128 位字符");
    return { email, password };
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
      const { email, password } = credentials(input),
        code =
          typeof input.inviteCode === "string"
            ? input.inviteCode.trim().toUpperCase()
            : "";
      if (!/^[A-Z0-9-]{8,40}$/.test(code))
        throw new AppError("请输入有效的邀请码");
      const salt = randomBytes(16).toString("hex"),
        hash = (await derive(password, salt, 64)).toString("hex");
      return store.audited("creator", "creator.register", "", () => {
        const invite = db
          .prepare("SELECT * FROM invitations WHERE code_hash=?")
          .get(digest(code));
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
          throw new AppError("该邮箱已注册，请直接登录", 409);
        const id = randomUUID(),
          created = new Date().toISOString();
        db.prepare(
          "INSERT INTO creator_accounts(id,email,password_hash,salt,created_at,invite_id) VALUES(?,?,?,?,?,?)",
        ).run(id, email, hash, salt, created, invite.id);
        const country = recordAccess(req, id, true);
        db.prepare("INSERT INTO creator_profiles VALUES(?,?,?,?,?)").run(
          id,
          "创作者 " + id.slice(0, 4),
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
            created_at: created,
            emailVerified: false,
            country,
          },
          token: session(id),
        };
      });
    },
    async login(req, input) {
      limited(req);
      const { email, password } = credentials(input),
        row = db
          .prepare("SELECT * FROM creator_accounts WHERE email=?")
          .get(email);
      const hash = await derive(
        password,
        row?.salt || "unknown-account-salt",
        64,
      );
      if (!row || !timingSafeEqual(hash, Buffer.from(row.password_hash, "hex")))
        throw new AppError("邮箱或密码不正确", 401);
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
        row.country = recordAccess(req, row.id);
        return { user: safe(row), token: session(row.id) };
      });
    },
    updateNote(actor, id, input) {
      if (typeof input.note !== "string" || input.note.length > 1000)
        throw new AppError("内部备注不超过 1000 字");
      return store.audited(actor, "customer.note", id, () => {
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
      return db
        .prepare(
          "SELECT id,hint,code,label,used,active,created_at,owner_id FROM invitations" +
            (ownerId ? " WHERE owner_id=?" : "") +
            " ORDER BY created_at DESC",
        )
        .all(...(ownerId ? [ownerId] : []));
    },
    createInvite(actor, input, ownerId = "super") {
      const label = String(input.label || "创作者邀请")
          .trim()
          .slice(0, 80),
        alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code;
      do {
        code = Array.from(randomBytes(8), (n) => alphabet[n & 31]).join("");
      } while (
        db
          .prepare("SELECT id FROM invitations WHERE code_hash=?")
          .get(digest(code))
      );
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
    users() {
      return db
        .prepare(
          `SELECT a.id,a.email,a.created_at,a.country,a.registration_ip,a.last_login_ip,a.last_login_at,a.last_login_agent,a.admin_note,a.country_source,a.registration_country,a.last_login_country,a.invite_id,p.name,p.bio,p.channel,
   (SELECT COUNT(*) FROM assignments WHERE owner_id=a.id) AS assignmentCount,
   (SELECT COUNT(*) FROM assignments WHERE owner_id=a.id AND status IN ('active','revision')) AS active,
   (SELECT COUNT(*) FROM assignments WHERE owner_id=a.id AND status='review') AS review,
   (SELECT COUNT(*) FROM assignments WHERE owner_id=a.id AND status='completed') AS completed,
   (SELECT COALESCE(SUM(amount),0) FROM ledger WHERE owner_id=a.id) AS available,
   (SELECT COALESCE(SUM(amount),0) FROM ledger WHERE owner_id=a.id AND kind='reward') AS earned
   FROM creator_accounts a JOIN creator_profiles p ON p.user_id=a.id ORDER BY a.created_at DESC`,
        )
        .all()
        .map(({ active, review, completed, available, earned, ...u }) => ({
          ...u,
          emailVerified: false,
          counts: { active, review, completed },
          wallet: { available, earned },
        }));
    },
  };
}
