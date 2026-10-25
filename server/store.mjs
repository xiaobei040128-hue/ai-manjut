import {initializeThirdPlan,thirdPlan,bindThirdPlan} from './third-plan.mjs';
import { AsyncLocalStorage } from "node:async_hooks";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {shanghaiDay} from './time.mjs';

const catalog = [
  [
    "secret-wife",
    "总裁的秘密妻子",
    "TikTok",
    80,
    "英文",
    300,
    45,
    3,
    "都市爱情",
    "契约婚姻背后，是他蓄谋已久的温柔。以情绪张力和剧情反转，开启你的下一条爆款。",
    "/art/hero-v2.webp",
    "高佣推荐",
    36,
  ],
  [
    "revenge-queen",
    "重生之复仇女王",
    "YouTube",
    60,
    "中文",
    800,
    110,
    5,
    "重生逆袭",
    "重来一次，她选择改写自己的结局。节奏紧凑的女性成长故事，适合系列化内容创作。",
    "/art/revenge-v2.webp",
    "热门",
    50,
  ],
  [
    "wolf-contract",
    "狼人王子的契约新娘",
    "Facebook",
    100,
    "英文",
    500,
    70,
    3,
    "奇幻爱情",
    "月光、古堡与一纸契约。当两个世界相遇，命运也有了新的答案。",
    "/art/wolf-v2.webp",
    "新上线",
    30,
  ],
  [
    "campus-diary",
    "校园甜宠日记",
    "TikTok",
    50,
    "中文",
    200,
    30,
    3,
    "青春校园",
    "从一次偶遇开始，记录青春里那些微小而明亮的心动。轻盈甜宠，适合日常连载。",
    "/art/campus-v2.webp",
    "新手友好",
    60,
  ],
  [
    "last-survivor",
    "末世生存者",
    "YouTube",
    80,
    "英文",
    1000,
    150,
    5,
    "科幻冒险",
    "当熟悉的世界被重写，一群普通人开始寻找新的秩序。高能情节与悬念并行。",
    "/art/survival-v2.webp",
    "高佣推荐",
    25,
  ],
];
export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const now = () => new Date().toISOString();
const parse = (v, fallback = {}) => {
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};
const text = (v, max = 500) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
export function createStore(file, {fixtures=false}={}) {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  try {
  db.exec(
    "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
  );
  db.exec(`
 CREATE TABLE IF NOT EXISTS profile(id INTEGER PRIMARY KEY CHECK(id=1),name TEXT NOT NULL,bio TEXT NOT NULL,channel TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,title TEXT NOT NULL,platform TEXT NOT NULL,episodes INTEGER NOT NULL,language TEXT NOT NULL,deposit INTEGER NOT NULL,commission INTEGER NOT NULL,posts INTEGER NOT NULL,genre TEXT NOT NULL,description TEXT NOT NULL,cover TEXT NOT NULL,badge TEXT NOT NULL,slots INTEGER NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS assignments(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),status TEXT NOT NULL CHECK(status IN ('active','review','revision','completed','cancelled')),created_at TEXT NOT NULL,deadline TEXT NOT NULL,draft TEXT NOT NULL DEFAULT '{}',submitted_at TEXT,reviewed_at TEXT,review_note TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS submissions(id TEXT PRIMARY KEY,assignment_id TEXT NOT NULL REFERENCES assignments(id),version INTEGER NOT NULL,links TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL,reviewed_at TEXT,review_note TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS uploads(id TEXT PRIMARY KEY,assignment_id TEXT REFERENCES assignments(id),name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,path TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS submission_uploads(submission_id TEXT NOT NULL REFERENCES submissions(id),upload_id TEXT NOT NULL REFERENCES uploads(id),PRIMARY KEY(submission_id,upload_id));
 CREATE TABLE IF NOT EXISTS ledger(id INTEGER PRIMARY KEY AUTOINCREMENT,assignment_id TEXT REFERENCES assignments(id),kind TEXT NOT NULL,amount INTEGER NOT NULL,balance_after INTEGER NOT NULL,note TEXT NOT NULL,operation_key TEXT UNIQUE NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,assignment_id TEXT NOT NULL REFERENCES assignments(id),type TEXT NOT NULL,description TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS bookmarks(task_id TEXT PRIMARY KEY REFERENCES tasks(id),created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS materials(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,path TEXT UNIQUE NOT NULL,kind TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,assignment_id TEXT REFERENCES assignments(id),is_read INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS admin_account(id INTEGER PRIMARY KEY CHECK(id=1),username TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,salt TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS admin_sessions(token_hash TEXT PRIMARY KEY,expires_at TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS admin_audit(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,detail TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS assignments_task_status ON assignments(task_id,status);
 CREATE INDEX IF NOT EXISTS submissions_assignment_version ON submissions(assignment_id,version DESC);
 CREATE INDEX IF NOT EXISTS uploads_assignment_time ON uploads(assignment_id,created_at,id);
 CREATE INDEX IF NOT EXISTS events_assignment_id ON events(assignment_id,id);
 CREATE INDEX IF NOT EXISTS materials_task_active ON materials(task_id,active,created_at);
 `);
  if (!db.prepare("PRAGMA table_info(notifications)").all().some((c) => c.name === "task_id"))
    db.exec("ALTER TABLE notifications ADD COLUMN task_id TEXT REFERENCES tasks(id)");
  for(const column of ['category','record_id'])if(!db.prepare('PRAGMA table_info(notifications)').all().some(c=>c.name===column))db.exec("ALTER TABLE notifications ADD COLUMN "+column+" TEXT NOT NULL DEFAULT ''");
  if (!db.prepare('PRAGMA table_info(tasks)').all().some(c=>c.name==='stage')) db.exec('ALTER TABLE tasks ADD COLUMN stage INTEGER NOT NULL DEFAULT 1');
  if (!db.prepare('PRAGMA table_info(tasks)').all().some(c=>c.name==='premium')) db.exec('ALTER TABLE tasks ADD COLUMN premium INTEGER NOT NULL DEFAULT 0');
  db.exec(`CREATE TABLE IF NOT EXISTS commission_policy(id INTEGER PRIMARY KEY CHECK(id=1),rate_bps INTEGER,updated_at TEXT NOT NULL);
    INSERT OR IGNORE INTO commission_policy(id,rate_bps,updated_at) VALUES(1,NULL,'');
    CREATE TABLE IF NOT EXISTS assignment_terms(assignment_id TEXT PRIMARY KEY REFERENCES assignments(id),amount INTEGER NOT NULL,commission INTEGER NOT NULL,rate_bps INTEGER,stage INTEGER NOT NULL);
    INSERT OR IGNORE INTO assignment_terms(assignment_id,amount,commission,rate_bps,stage) SELECT a.id,t.deposit,t.commission,NULL,t.stage FROM assignments a JOIN tasks t ON t.id=a.task_id;`);
  for(const [column,type] of [['premium','INTEGER NOT NULL DEFAULT 0'],['sequence','INTEGER'],['dispatch_day','TEXT']])if(!db.prepare('PRAGMA table_info(assignment_terms)').all().some(c=>c.name===column))db.exec('ALTER TABLE assignment_terms ADD COLUMN '+column+' '+type);
  db.exec("CREATE TABLE IF NOT EXISTS premium_dispatch_policy(user_id TEXT NOT NULL,day TEXT NOT NULL,sequences TEXT NOT NULL,revision INTEGER NOT NULL,updated_by TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(user_id,day))");
  if(!db.prepare('PRAGMA table_info(commission_policy)').all().some(c=>c.name==='revision'))db.exec('ALTER TABLE commission_policy ADD COLUMN revision INTEGER NOT NULL DEFAULT 0');
  initializeThirdPlan(db);
  const policy=()=>db.prepare('SELECT * FROM commission_policy WHERE id=1').get();
  const quote=(row,rate=policy().rate_bps)=>{return {...row,premium:0,commission:rate===null?row.commission:Math.round(row.deposit*rate/10000),commission_rate_bps:rate};};
  function frozenTask(a,t,terms=db.prepare('SELECT * FROM assignment_terms WHERE assignment_id=?').get(a.id)){return terms?{...t,deposit:terms.amount,commission:terms.commission,commission_rate_bps:terms.rate_bps,stage:terms.stage,premium:terms.premium,dispatch_sequence:terms.sequence,dispatch_day:terms.dispatch_day}:t;}
  const context = new AsyncLocalStorage();
  const owner = () => context.getStore() || 'legacy';
  const scoped = () => !!context.getStore();
  for (const table of ['assignments','ledger','notifications']) {
    if (!db.prepare('PRAGMA table_info('+table+')').all().some(c=>c.name==='owner_id'))
      db.exec("ALTER TABLE "+table+" ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'legacy'");
  }
  const hadCreatorProfiles=!!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='creator_profiles'").get();
  db.exec(`CREATE TABLE IF NOT EXISTS creator_profiles(user_id TEXT PRIMARY KEY,name TEXT NOT NULL,bio TEXT NOT NULL,channel TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS creator_bookmarks(user_id TEXT NOT NULL,task_id TEXT NOT NULL REFERENCES tasks(id),created_at TEXT NOT NULL,PRIMARY KEY(user_id,task_id));
    DROP INDEX IF EXISTS one_live_task;
    CREATE UNIQUE INDEX IF NOT EXISTS one_live_task_per_owner ON assignments(owner_id,task_id) WHERE status IN ('active','review','revision');
    CREATE INDEX IF NOT EXISTS assignments_owner ON assignments(owner_id,created_at);
    CREATE INDEX IF NOT EXISTS ledger_owner ON ledger(owner_id,id);
    CREATE INDEX IF NOT EXISTS notifications_owner_time ON notifications(owner_id,created_at,id);
    CREATE INDEX IF NOT EXISTS notifications_owner_read ON notifications(owner_id,is_read);
  `);
  if(!hadCreatorProfiles)db.exec("INSERT OR IGNORE INTO creator_profiles SELECT 'legacy',name,bio,channel,created_at FROM profile; INSERT OR IGNORE INTO creator_bookmarks SELECT 'legacy',task_id,created_at FROM bookmarks;");
  const statements = new Map();
  const prepared = (sql) => {
    let statement = statements.get(sql);
    if (!statement) {statement = db.prepare(sql); statements.set(sql, statement);}
    return statement;
  };
  const get = (sql, ...args) => prepared(sql).get(...args),
    all = (sql, ...args) => prepared(sql).all(...args),
    run = (sql, ...args) => prepared(sql).run(...args);
  let transactionDepth = 0;
  function ensureUserActive(userId) {
    if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='creator_accounts'").get() && db.prepare('PRAGMA table_info(creator_accounts)').all().some(c=>c.name==='frozen') && db.prepare('SELECT frozen FROM creator_accounts WHERE id=?').get(userId)?.frozen)throw new AppError('账号已冻结，请联系管理员',403);
  }
  function ensureActive() {
    if(context.getStore())ensureUserActive(owner());
  }
  function atomic(fn) {
    ensureActive();
    if (transactionDepth) return fn();
    db.exec("BEGIN IMMEDIATE");
    transactionDepth++;
    try {
      const r = fn();
      db.exec("COMMIT");
      return r;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    } finally {transactionDepth--;}
  }
  if (!get("SELECT id FROM profile WHERE id=1"))
    atomic(() => {
      run(
        "INSERT INTO profile VALUES(1,?,?,?,?)",
        "林间创作室",
        "把好故事，分享给更多人。",
        "",
        now(),
      );
      if(fixtures)run(
        "INSERT INTO ledger(kind,amount,balance_after,note,operation_key,created_at) VALUES(?,?,?,?,?,?)",
        "credit",
        200000,
        200000,
        "本地测试账户初始额度",
        "initial-credit",
        now(),
      );
    });
  db.exec("INSERT OR IGNORE INTO creator_profiles SELECT 'legacy',name,bio,channel,created_at FROM profile");
  for (const [
    id,
    title,
    platform,
    episodes,
    language,
    deposit,
    commission,
    posts,
    genre,
    description,
    cover,
    badge,
    slots,
  ] of (fixtures?catalog:[]))
    run(
      "INSERT OR IGNORE INTO tasks(id,title,platform,episodes,language,deposit,commission,posts,genre,description,cover,badge,slots,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      id,
      title,
      platform,
      episodes,
      language,
      deposit * 100,
      commission * 100,
      posts,
      genre,
      description,
      cover,
      badge,
      slots,
      now(),
    );
  function balance(userId) {
    return userId || scoped() ? get("SELECT COALESCE(SUM(amount),0) AS n FROM ledger WHERE owner_id=?",userId||owner()).n : get("SELECT COALESCE(SUM(amount),0) AS n FROM ledger").n;
  }
  function event(id, type, description) {
    run(
      "INSERT INTO events(assignment_id,type,description,created_at) VALUES(?,?,?,?)",
      id,
      type,
      description,
      now(),
    );
  }
  function notify(title, body, id = null, taskId = null) {
    const recipients = id ? [get('SELECT owner_id FROM assignments WHERE id=?',id)?.owner_id||owner()] : scoped() ? [owner()] : all('SELECT user_id FROM creator_profiles').map(p=>p.user_id);
    for(const userId of recipients)run("INSERT INTO notifications(id,title,body,assignment_id,is_read,created_at,task_id,owner_id) VALUES(?,?,?,?,0,?,?,?)",randomUUID(),title,body,id,now(),taskId,userId);
  }
  function notifyUser(userId,title,body,category='general',recordId=''){
    run('INSERT INTO notifications(id,title,body,is_read,created_at,owner_id,category,record_id) VALUES(?,?,?,0,?,?,?,?)',randomUUID(),title,body,now(),userId,category,recordId);
  }
  function notificationPage({before,limit=20,unread=false}={}){
    if(!Number.isInteger(limit)||limit<1||limit>100||before!==undefined&&(!Number.isSafeInteger(before)||before<1)||typeof unread!=='boolean')throw new AppError('无效消息分页参数');
    const params=[owner()],clauses=['owner_id=?'];if(before!==undefined){clauses.push('rowid<?');params.push(before);}if(unread)clauses.push('is_read=0');
    const rows=all('SELECT rowid AS cursor,* FROM notifications WHERE '+clauses.join(' AND ')+' ORDER BY rowid DESC LIMIT ?',...params,limit+1),hasMore=rows.length>limit,visible=rows.slice(0,limit);
    return {notifications:visible.map(({cursor,...row})=>row),nextCursor:hasMore?visible.at(-1).cursor:null,unreadCount:get('SELECT COUNT(*) n FROM notifications WHERE owner_id=? AND is_read=0',owner()).n};
  }
  function ledger(id, kind, amount, note, operation) {
    const userId=id?get('SELECT owner_id FROM assignments WHERE id=?',id).owner_id:owner();
    const current=balance(userId);
    if(current+amount<0)throw new AppError('可用余额不足，请先查看钱包中的可用余额',409);
    run("INSERT INTO ledger(assignment_id,kind,amount,balance_after,note,operation_key,created_at,owner_id) VALUES(?,?,?,?,?,?,?,?)",id,kind,amount,current+amount,note,operation,now(),userId);
  }
  function task(row) {
    if (!row) return null;
    return {
      ...quote(row),
      materials: all(
        "SELECT * FROM materials WHERE task_id=? AND active=1 ORDER BY created_at,id",
        row.id,
      ),
      bookmarked: !!get("SELECT 1 FROM creator_bookmarks WHERE task_id=? AND user_id=?", row.id,owner()),
      remaining: Math.max(
        0,
        row.slots -
          get(
            "SELECT COUNT(*) AS n FROM assignments WHERE task_id=? AND status!='cancelled'",
            row.id,
          ).n,
      ),
      tags: [row.genre, row.language, row.platform],
      regions: ["US", "UK", "CA"],
    };
  }
  function getTask(id) {
    if (typeof id !== "string" || !id || id.length > 80)
      throw new AppError("无效的任务标识");
    const t = task(get("SELECT * FROM tasks WHERE id=?", id));
    if (!t) throw new AppError("任务不存在", 404);
    return t;
  }
  function assignment(id) {
    const a = get("SELECT * FROM assignments WHERE id=?", id);
    if (!a || (scoped() && a.owner_id!==owner())) throw new AppError("领取记录不存在", 404);
    const submissions = all(
      "SELECT * FROM submissions WHERE assignment_id=? ORDER BY version DESC",
      id,
    ).map((s) => ({
      ...s,
      links: parse(s.links, []),
      uploads: all(
        "SELECT u.* FROM uploads u JOIN submission_uploads su ON su.upload_id=u.id WHERE su.submission_id=? ORDER BY u.created_at,u.id",
        s.id,
      ),
    }));
    return {
      ...a,
      task: frozenTask(a,getTask(a.task_id)),
      draft: parse(a.draft),
      uploads: all(
        "SELECT * FROM uploads WHERE assignment_id=? ORDER BY created_at,id",
        id,
      ),
      events: all("SELECT * FROM events WHERE assignment_id=? ORDER BY id", id),
      submissions,
    };
  }
  function summary({owners}={}) {
    if(owners!==undefined&&(!Array.isArray(owners)||owners.some(id=>typeof id!=='string'||!id||id.length>100)))throw new AppError('无效客户范围');
    const selectedOwners=scoped()?[owner()]:owners,restricted=selectedOwners!==undefined,scopeArgs=restricted?[JSON.stringify(selectedOwners)]:[],whereOwner=column=>restricted?column+' IN (SELECT value FROM json_each(?))':'1';
    // Build the graph with a fixed number of reads, rather than one query per record.
    const group = (rows, key) => {
      const result = new Map();
      for (const row of rows) {
        const items = result.get(row[key]);
        if (items) items.push(row); else result.set(row[key], [row]);
      }
      return result;
    };
    const rawAssignments = all('SELECT * FROM assignments WHERE '+whereOwner('owner_id')+' ORDER BY created_at DESC',...scopeArgs);
    const taken = new Map(all("SELECT task_id,COUNT(*) n FROM assignments WHERE status!='cancelled' GROUP BY task_id").map(row=>[row.task_id,row.n]));
    const rate=policy().rate_bps;
    const frozenTerms=new Map(all('SELECT f.* FROM assignment_terms f JOIN assignments a ON a.id=f.assignment_id WHERE '+whereOwner('a.owner_id'),...scopeArgs).map(row=>[row.assignment_id,row]));
    const personalOwner=scoped()||!restricted?owner():null;
    const bookmarks = personalOwner?all("SELECT task_id FROM creator_bookmarks WHERE user_id=?",personalOwner).map((x) => x.task_id):[];
    const saved = new Set(bookmarks);
    const materials = group(all("SELECT * FROM materials WHERE active=1 ORDER BY created_at,id"), "task_id");
    const tasks = all("SELECT * FROM tasks ORDER BY created_at,id").map((row) => ({...quote(row,rate),materials:materials.get(row.id)||[],bookmarked:saved.has(row.id),remaining:Math.max(0,row.slots-(taken.get(row.id)||0)),tags:[row.genre,row.language,row.platform],regions:["US","UK","CA"]}));
    const taskMap = new Map(tasks.map((t) => [t.id,t]));
    const uploads = group(all('SELECT u.* FROM uploads u JOIN assignments a ON a.id=u.assignment_id WHERE '+whereOwner('a.owner_id')+' ORDER BY u.created_at,u.id',...scopeArgs),'assignment_id');
    const evidence = group(all('SELECT su.submission_id,u.* FROM assignments a JOIN submissions s ON s.assignment_id=a.id JOIN submission_uploads su ON su.submission_id=s.id JOIN uploads u ON u.id=su.upload_id WHERE '+whereOwner('a.owner_id')+' ORDER BY u.created_at,u.id',...scopeArgs),'submission_id');
    const submissions = group(all('SELECT s.* FROM submissions s JOIN assignments a ON a.id=s.assignment_id WHERE '+whereOwner('a.owner_id')+' ORDER BY s.version DESC',...scopeArgs).map((s) => ({...s,links:parse(s.links,[]),uploads:(evidence.get(s.id)||[]).map(({submission_id,...u})=>u)})), "assignment_id");
    const events = group(all('SELECT e.* FROM events e JOIN assignments a ON a.id=e.assignment_id WHERE '+whereOwner('a.owner_id')+' ORDER BY e.id',...scopeArgs),'assignment_id');
    const assignments = rawAssignments.map((a) => ({...a,task:frozenTask(a,taskMap.get(a.task_id),frozenTerms.get(a.id)),draft:parse(a.draft),uploads:uploads.get(a.id)||[],events:events.get(a.id)||[],submissions:submissions.get(a.id)||[]}));
    const hasFunds=!!get("SELECT name FROM sqlite_master WHERE type='table' AND name='fund_requests'");
    const withdrawalHeld=hasFunds?get("SELECT COALESCE(SUM(amount),0) AS n FROM fund_requests WHERE kind='withdrawal' AND status IN ('review','paying') AND "+whereOwner("user_id"),...scopeArgs).n:0;
    const coverHeld=get("SELECT name FROM sqlite_master WHERE type='table' AND name='newcomer_cover_orders'")?get("SELECT COALESCE(SUM(amount),0) n FROM newcomer_cover_orders WHERE state='purchased' AND "+whereOwner('owner_id'),...scopeArgs).n:0;
    const rows = all('SELECT * FROM ledger WHERE '+whereOwner('owner_id')+' ORDER BY id DESC',...scopeArgs);
    return {
      profile: personalOwner?get("SELECT * FROM creator_profiles WHERE user_id=?",personalOwner):null,
      wallet: {
        available: rows.reduce((sum,row)=>sum+row.amount,0),
        withdrawalHeld,
        coverHeld,
        held: (get("SELECT name FROM sqlite_master WHERE type='table' AND name='task_balance_reservations'")?get("SELECT COALESCE(SUM(amount),0) n FROM task_balance_reservations WHERE state='reserved' AND "+whereOwner('owner_id'),...scopeArgs).n:0) + coverHeld + (get("SELECT name FROM sqlite_master WHERE type='table' AND name='community_license_orders'")?get("SELECT COALESCE(SUM(amount),0) n FROM community_license_orders WHERE state='purchased' AND "+whereOwner('owner_id'),...scopeArgs).n:0) + withdrawalHeld + get(
          "SELECT COALESCE(SUM(COALESCE(f.amount,t.deposit)),0) AS n FROM assignments a JOIN tasks t ON t.id=a.task_id LEFT JOIN assignment_terms f ON f.assignment_id=a.id WHERE a.status IN ('active','review','revision') AND "+whereOwner("a.owner_id"),...scopeArgs,
        ).n,
        earned: rows.filter(row=>row.kind==='reward').reduce((sum,row)=>sum+row.amount,0),
        currency: "USD",
        testMode: false,
      },
      counts: {
        active: assignments.filter((a) =>
          ["active", "revision"].includes(a.status),
        ).length,
        review: assignments.filter((a) => a.status === "review").length,
        completed: assignments.filter((a) => a.status === "completed").length,
      },
      assignments,
      ledger: rows,
      notificationsUnread:personalOwner?get('SELECT COUNT(*) n FROM notifications WHERE owner_id=? AND is_read=0',personalOwner).n:0,
      notifications: personalOwner?all(
        "SELECT * FROM notifications WHERE owner_id=? ORDER BY created_at DESC LIMIT 100",personalOwner,
      ):[],
      bookmarks,
      savedTasks: tasks.filter((t) => t.bookmarked),
      tasks: tasks.filter((t) => t.active),
    };
  }
  function editable(a) {
    if (!["active", "revision"].includes(a.status))
      throw new AppError("当前任务状态不允许修改", 409);
  }
  function claim(taskId,expected) {
    return atomic(() => {
      const t = getTask(taskId);
      if (!t.active) throw new AppError("该任务已暂停领取", 409);
      const old = get(
        "SELECT id FROM assignments WHERE task_id=? AND owner_id=? AND status IN ('active','review','revision')",
        taskId,owner(),
      );
      if (old) return assignment(old.id);
      if(policy().rate_bps!==null && scoped()){
        if(t.stage===2&&!get("SELECT a.id FROM assignments a JOIN assignment_terms f ON f.assignment_id=a.id WHERE a.owner_id=? AND a.status='completed' AND f.stage=1",owner()))throw new AppError('请先完成第一阶段任务并通过审核',403);
        if(t.stage===3&&!get("SELECT id FROM stage_enrollments WHERE user_id=? AND status='approved' ORDER BY rowid DESC LIMIT 1",owner()))throw new AppError('请先完成第三阶段报名审核',403);
      }
      if(!fixtures&&policy().rate_bps===null)throw new AppError('平台尚未配置佣金比例',409);
      if(policy().rate_bps!==null&&scoped()&&(!expected||expected.amount!==t.deposit||expected.commission!==t.commission||expected.rateBps!==t.commission_rate_bps))throw new AppError('任务金额或佣金规则已更新，请刷新后确认领取',409);
      if (t.remaining < 1) throw new AppError("任务名额已满", 409);
      if(t.stage===3){const plan=thirdPlan(db,owner());if(plan.complete||plan.waiting||plan.claimed>=plan.limit)throw new AppError(plan.complete?'五天作品计划已全部完成':'请完成当前批次，下一天再开启新任务',409);if(get("SELECT id FROM assignments a JOIN assignment_terms f ON f.assignment_id=a.id WHERE a.owner_id=? AND f.stage=3 AND a.status IN ('active','review','revision')",owner()))throw new AppError('请先完成当前作品',409);}
      const id = randomUUID(),
        created = now(),
        deadline = new Date(Date.now() + 48 * 3600e3).toISOString();
      run(
        "INSERT INTO assignments(id,task_id,status,created_at,deadline,owner_id) VALUES(?,?,?,?,?,?)",
        id,
        taskId,
        "active",
        created,
        deadline,owner(),
      );
      let sequence=null,dispatchDay=null,premium=0;
      if(t.stage===3){dispatchDay=shanghaiDay();sequence=get('SELECT COALESCE(MAX(f.sequence),0)+1 n FROM assignment_terms f JOIN assignments a ON a.id=f.assignment_id WHERE a.owner_id=? AND f.dispatch_day=?',owner(),dispatchDay).n;const config=get('SELECT sequences FROM premium_dispatch_policy WHERE user_id=? AND day=?',owner(),dispatchDay);premium=config&&JSON.parse(config.sequences).includes(sequence)?1:0;}
      run('INSERT INTO assignment_terms(assignment_id,amount,commission,rate_bps,stage,premium,sequence,dispatch_day) VALUES(?,?,?,?,?,?,?,?)',id,t.deposit,t.commission,t.commission_rate_bps,t.stage,premium,sequence,dispatchDay);
      if(t.stage===3)bindThirdPlan(db,owner(),id);
      ledger(id, "hold", -t.deposit, "领取任务 · " + t.title, "claim:" + id);
      event(id, "claimed", "任务已领取，任务本金已冻结");
      notify(premium?"高阶任务已领取":"新任务已领取", t.title + " · 请在 48 小时内完成发布", id);
      return assignment(id);
    });
  }
  function saveDraft(id, input) {
    return atomic(() => {
      const a = assignment(id);
      editable(a);
      if (input.links !== undefined && !Array.isArray(input.links))
        throw new AppError("视频链接必须为列表");
      const links = Array.isArray(input.links)
        ? input.links.slice(0, a.task.posts).map((v) => text(v, 2048))
        : a.draft.links || [];
      const note = text(input.note ?? a.draft.note, 2000);
      const next = { ...a.draft, links, note, savedAt: now() };
      run(
        "UPDATE assignments SET draft=? WHERE id=?",
        JSON.stringify(next),
        id,
      );
      return assignment(id);
    });
  }
  function addUpload(id, meta) {
    return atomic(() => {
      if (id) {
        const a = assignment(id);
        editable(a);
        if (a.uploads.length >= 10)
          throw new AppError("每个任务最多保留 10 张截图");
      }
      const upload = {
        id: randomUUID(),
        assignment_id: id || null,
        ...meta,
        created_at: now(),
      };
      run(
        "INSERT INTO uploads VALUES(?,?,?,?,?,?,?)",
        upload.id,
        upload.assignment_id,
        upload.name,
        upload.mime,
        upload.size,
        upload.path,
        upload.created_at,
      );
      if (id) event(id, "uploaded", "已添加发布截图：" + upload.name);
      return upload;
    });
  }
  function removeUpload(id) {
    return atomic(() => {
      const u = get("SELECT * FROM uploads WHERE id=?", id);
      if (!u) throw new AppError("截图不存在", 404);
      if (!u.assignment_id && scoped()) throw new AppError("截图不存在",404);
      if (u.assignment_id) editable(assignment(u.assignment_id));
      if (get("SELECT 1 FROM submission_uploads WHERE upload_id=?", id))
        throw new AppError("已提交审核的截图不可删除，请添加新截图");
      run("DELETE FROM uploads WHERE id=?", id);
      return u;
    });
  }
  function submit(id, input) {
    return atomic(() => {
      const a = assignment(id);
      editable(a);
      if (Date.parse(a.deadline) < Date.now())
        throw new AppError("任务已超过截止时间，请取消并重新领取", 409);
      const links = input.links;
      if (!Array.isArray(links) || links.length !== a.task.posts)
        throw new AppError("请填写 " + a.task.posts + " 条视频链接");
      const normalized = links.map((raw) => {
        let u;
        try {
          u = new URL(text(raw, 2048));
        } catch {
          throw new AppError("请输入完整有效的视频链接");
        }
        if (u.protocol !== "https:" || !u.hostname.includes("."))
          throw new AppError("视频链接必须为完整的 HTTPS 地址");
        return u.href;
      });
      if (new Set(normalized).size !== normalized.length)
        throw new AppError("每条视频链接必须不同");
      const ids = Array.isArray(input.uploadIds)
        ? [...new Set(input.uploadIds)]
        : a.uploads.map((u) => u.id);
      if (ids.length < a.task.posts)
        throw new AppError("请上传至少 " + a.task.posts + " 张发布截图");
      for (const uid of ids)
        if (
          !get("SELECT id FROM uploads WHERE id=? AND assignment_id=?", uid, id)
        )
          throw new AppError("截图与当前任务不匹配");
      const version = get(
        "SELECT COALESCE(MAX(version),0)+1 AS n FROM submissions WHERE assignment_id=?",
        id,
      ).n;
      const sid = randomUUID(),
        time = now();
      run(
        "INSERT INTO submissions(id,assignment_id,version,links,note,created_at) VALUES(?,?,?,?,?,?)",
        sid,
        id,
        version,
        JSON.stringify(normalized),
        text(input.note, 2000),
        time,
      );
      for (const uid of ids)
        run("INSERT INTO submission_uploads VALUES(?,?)", sid, uid);
      run(
        "UPDATE assignments SET status='review',submitted_at=?,draft=? WHERE id=?",
        time,
        JSON.stringify({
          links: normalized,
          note: text(input.note, 2000),
          savedAt: time,
        }),
        id,
      );
      event(id, "submitted", "第 " + version + " 次提交已进入审核");
      notify("提交成功", a.task.title + " 已进入审核队列", id);
      return assignment(id);
    });
  }
  function review(id, input) {
    return atomic(() => {
      const a = assignment(id);
      if (a.status === "completed" && input.decision === "approve") return a;
      if (a.status !== "review")
        throw new AppError("该任务当前不在审核中", 409);
      const s = a.submissions[0];
      const reason = text(input.reason, 1000);
      if (!["approve", "changes"].includes(input.decision))
        throw new AppError("无效的审核操作");
      if (input.decision === "changes" && !reason)
        throw new AppError("请填写具体的修改意见");
      const time = now(),
        approved = input.decision === "approve";
      if(approved)ensureUserActive(a.owner_id);
      run(
        "UPDATE submissions SET status=?,reviewed_at=?,review_note=? WHERE id=?",
        approved ? "approved" : "changes",
        time,
        reason,
        s.id,
      );
      run(
        "UPDATE assignments SET status=?,reviewed_at=?,review_note=? WHERE id=?",
        approved ? "completed" : "revision",
        time,
        reason,
        id,
      );
      if (approved) {
        ledger(
          id,
          "release",
          a.task.deposit,
          "任务本金返还 · " + a.task.title,
          "release:" + id,
        );
        ledger(
          id,
          "reward",
          a.task.commission,
          "任务佣金 · " + a.task.title,
          "reward:" + id,
        );
        event(
          id,
          "approved",
          "审核通过，任务本金已返还，佣金已记入资金账本",
        );
        notify("任务审核通过", a.task.title + " · 任务佣金已到账", id);
      } else {
        event(id, "changes", "审核要求修改：" + reason);
        notify("任务需要修改", reason, id);
      }
      return assignment(id);
    });
  }
  function cancel(id) {
    return atomic(() => {
      const a = assignment(id);
      if (a.status === "cancelled") return a;
      editable(a);
      run("UPDATE assignments SET status='cancelled' WHERE id=?", id);
      ledger(
        id,
        "refund",
        a.task.deposit,
        "取消任务返还 · " + a.task.title,
        "cancel:" + id,
      );
      event(id, "cancelled", "任务已取消，冻结任务本金已返还");
      notify("任务已取消", a.task.title + " · 任务本金已返还", id);
      return assignment(id);
    });
  }
  function validateTask(input) {
    const title = text(input.title, 60),
      description = text(input.description, 2000),
      platform = text(input.platform, 20),
      language = text(input.language, 20),
      genre = text(input.genre, 30);
    if (
      title.length < 2 ||
      !description ||
      !["TikTok", "YouTube", "Facebook"].includes(platform) ||
      !["中文", "英文"].includes(language)
    )
      throw new AppError("请完整填写剧集名称、简介、发布平台与语言");
    if(!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(String(input.deposit)))throw new AppError('任务金额最多保留两位小数');
    const deposit = Math.round(Number(input.deposit) * 100),
      commission = policy().rate_bps===null?Math.round(Number(input.commission) * 100):Math.round(deposit*policy().rate_bps/10000),
      posts = Number(input.posts),
      episodes = Number(input.episodes),
      slots = Number(input.slots ?? 30);
    if (
      !Number.isSafeInteger(deposit) ||
      deposit < 0 ||
      deposit > 1e7 ||
      !Number.isSafeInteger(commission) ||
      commission < 0 ||
      commission > 1e7 ||
      !Number.isInteger(posts) ||
      posts < 1 ||
      posts > 10 ||
      !Number.isInteger(episodes) ||
      episodes < 1 ||
      episodes > 1000 ||
      !Number.isInteger(slots) ||
      slots < 1 ||
      slots > 10000
    )
      throw new AppError("金额、发布数量、集数或名额超出范围");
    const cover = text(input.cover, 300);
    if (
      !/^\/(?:art|stories)\/[a-zA-Z0-9_.-]+$/.test(cover) &&
      !get(
        "SELECT id FROM uploads WHERE path=? AND assignment_id IS NULL",
        cover,
      )
    )
      throw new AppError("请选择或上传有效封面");
    const stage=Number(input.stage??1);if(![1,2,3].includes(stage))throw new AppError('请选择第一、二或三阶段');
    const premium=input.premium===true||input.premium===1||input.premium==='1'?1:0;
    return {title,description,platform,language,genre:genre||"都市剧情",deposit,commission,posts,episodes,slots,cover,stage,premium};
  }
  function createTask(input) {
    const {title,description,platform,language,genre,deposit,commission,posts,episodes,slots,cover,stage,premium}=validateTask(input);
    const id = randomUUID();
    run(
      "INSERT INTO tasks(id,title,platform,episodes,language,deposit,commission,posts,genre,description,cover,badge,slots,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      id,
      title,
      platform,
      episodes,
      language,
      deposit,
      commission,
      posts,
      genre || "都市剧情",
      description,
      cover,
      "新上线",
      slots,
      now(),
    );
    run('UPDATE tasks SET stage=?,premium=? WHERE id=?',stage,premium,id);
    notify("任务已发布", title + " 已在任务大厅上架", null, id);
    return getTask(id);
  }
  return {
    db,
    dispatchStatus(){return thirdPlan(db,owner());},
    notifications:notificationPage,
    notifyUser,
    commissionSettings:policy,
    setCommissionRate(rate,revision){if(revision!==undefined&&(!Number.isSafeInteger(revision)||revision<0))throw new AppError('请刷新后提交佣金配置');if(revision!==undefined&&revision!==policy().revision)throw new AppError('佣金比例已被其他页面更新，请重新读取后保存',409);if(!/^(?:0|[1-9]\d?)(?:\.\d{1,2})?$|^100(?:\.0{1,2})?$/.test(String(rate)))throw new AppError('佣金比例须为 0–100，最多两位小数');const bps=Math.round(Number(rate)*100);run('UPDATE commission_policy SET rate_bps=?,updated_at=?,revision=revision+1 WHERE id=1',bps,now());return policy();},
    asUser:(id,fn)=>context.run(id,fn),
    summary,
    getTask,
    assignment,
    claim,
    saveDraft,
    addUpload,
    removeUpload,
    submit,
    review,
    cancel,
    createTask,
    updateTask(id,input) {
      return atomic(() => {
        const old=getTask(id),next=validateTask({...old,deposit:old.deposit/100,commission:old.commission/100,...input});
        if(policy().rate_bps!==null&&input.commission!==undefined&&Math.round(Number(input.commission)*100)!==next.commission)throw new AppError('佣金由统一比例计算，不能单独修改',409);
        const claims=get("SELECT COUNT(*) AS n FROM assignments WHERE task_id=?",id).n;
        if(claims && ["deposit","commission","posts","platform","language","stage","premium"].some(key=>next[key]!==old[key])) throw new AppError("已有领取记录，金额、发布数量、平台和语言已锁定",409);
        if(next.slots < old.slots-old.remaining) throw new AppError("开放名额不能小于已使用名额",409);
        run("UPDATE tasks SET title=?,description=?,platform=?,language=?,genre=?,deposit=?,commission=?,posts=?,episodes=?,slots=?,cover=? WHERE id=?",next.title,next.description,next.platform,next.language,next.genre,next.deposit,next.commission,next.posts,next.episodes,next.slots,next.cover,id);
        run('UPDATE tasks SET stage=?,premium=? WHERE id=?',next.stage,next.premium,id);
        return getTask(id);
      });
    },
    audited(actor,action,target,fn,detail={}) {
      return atomic(() => {
        const result=fn();
        run("INSERT INTO admin_audit(actor,action,target,detail,created_at) VALUES(?,?,?,?,?)",text(actor,32),text(action,80),text(target||result?.id||result?.user?.id,100),JSON.stringify(detail),now());
        return result;
      });
    },
    auditLog() {return all("SELECT * FROM admin_audit ORDER BY id DESC LIMIT 200").map(row=>({...row,detail:parse(row.detail)}));},
    addMaterial(taskId, meta) {
      return atomic(() => {
        const t = getTask(taskId);
        if (t.materials.length >= 50)
          throw new AppError("每部剧集最多保留 50 份可用素材");
        const id = randomUUID(),
          time = now();
        run(
          "INSERT INTO materials(id,task_id,name,mime,size,path,kind,created_at) VALUES(?,?,?,?,?,?,?,?)",
          id,
          taskId,
          meta.name,
          meta.mime,
          meta.size,
          meta.path,
          meta.kind,
          time,
        );
        notify("素材已添加", t.title + " · " + meta.name, null, taskId);
        return get("SELECT * FROM materials WHERE id=?", id);
      });
    },
    archiveMaterial(id) {
      const record = get("SELECT * FROM materials WHERE id=?", id);
      if (!record) throw new AppError("素材不存在", 404);
      run("UPDATE materials SET active=0 WHERE id=?", id);
      return { ok: true };
    },
    restoreMaterial(id) {
      const record = get("SELECT * FROM materials WHERE id=?", id);
      if (!record) throw new AppError("素材不存在", 404);
      if (!record.active && getTask(record.task_id).materials.length >= 50)
        throw new AppError("可用素材数量已达上限");
      run("UPDATE materials SET active=1 WHERE id=?", id);
      return get("SELECT * FROM materials WHERE id=?", id);
    },
    listMaterials(taskId, includeArchived = false) {
      getTask(taskId);
      return all(
        "SELECT * FROM materials WHERE task_id=?" +
          (includeArchived ? "" : " AND active=1") +
          " ORDER BY created_at DESC,id",
        taskId,
      );
    },
    materialPath(path) {
      return get("SELECT * FROM materials WHERE path=?", path);
    },
    upload: (id) => get("SELECT * FROM uploads WHERE id=?", id),
    bookmark(id) {
      ensureActive();
      getTask(id);
      if(get('SELECT 1 FROM creator_bookmarks WHERE user_id=? AND task_id=?',owner(),id))run('DELETE FROM creator_bookmarks WHERE user_id=? AND task_id=?',owner(),id);
      else run('INSERT INTO creator_bookmarks VALUES(?,?,?)',owner(),id,now());
      return getTask(id);
    },
    profile(input) {
      ensureActive();
      const name=text(input.name,30),bio=text(input.bio,140),channel=text(input.channel,200);
      if(!name)throw new AppError('请输入创作者名称');
      run('UPDATE creator_profiles SET name=?,bio=?,channel=? WHERE user_id=?',name,bio,channel,owner());
      return get('SELECT * FROM creator_profiles WHERE user_id=?',owner());
    },
    readNotifications(id) {
      ensureActive();
      if(id&&!get('SELECT id FROM notifications WHERE id=? AND owner_id=?',id,owner()))throw new AppError('消息不存在',404);
      if(id)run('UPDATE notifications SET is_read=1 WHERE id=? AND owner_id=?',id,owner());
      else run('UPDATE notifications SET is_read=1 WHERE owner_id=?',owner());
      return {ok:true};
    },
    setTaskActive(id, active) {
      const current = getTask(id);
      if (current.active === Number(active)) return current;
      run("UPDATE tasks SET active=? WHERE id=?", active ? 1 : 0, id);
      notify(active ? "任务已恢复上架" : "任务已暂停", current.title + (active ? " 可继续领取" : " · 已领取的任务仍可继续完成"), null, id);
      return getTask(id);
    },
    allTasks() {
      return all("SELECT * FROM tasks ORDER BY created_at DESC").map(task);
    },
    close() {
      db.close();
    },
  };
  } catch (error) {
    db.close();
    throw error;
  }
}
