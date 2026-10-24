import {createPremiumDispatch} from './premium-dispatch.mjs';
import {createStageEnrollments} from "./stage-enrollments.mjs";
import {createActivityRewards} from "./activity-rewards.mjs";

import {initializeGeoCountry} from "./geo-country.mjs";
import http from "node:http";
import { createReadStream } from "node:fs";
import { randomUUID,createHash,timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile, unlink, stat } from "node:fs/promises";
import { resolve, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createStore, AppError } from "./store.mjs";
import { receiveMaterial, parseRange } from "./materials.mjs";
import { streamBackup } from "./backup.mjs";
import { serveStatic } from "./static.mjs";
import { createOperatorScope } from "./operators.mjs";
import { createFinance } from "./finance.mjs";
import { createCreatorAuth } from "./creator-auth.mjs";
import { createAdminAuth } from "./auth.mjs";
import { customerDirectory } from "./customer-directory.mjs";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = process.argv.slice(2),
  arg = (name, fallback) =>
    args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const port = Number(arg("--port", process.env.PORT || "4173")),
  host = arg("--host", "127.0.0.1");
const dataDir = resolve(
  process.env.DRAMA_DATA_DIR || join(root, "runtime-data"),
);
await mkdir(join(dataDir, "uploads"), { recursive: true });
const store = createStore(join(dataDir, "workspace.sqlite"));
const adminAuth = createAdminAuth(store,port);
if(process.env.DRAMA_ALLOWED_HOSTS?.trim()){
 if(process.env.DRAMA_COOKIE_SECURE!=='1')throw new Error('Public hosts require DRAMA_COOKIE_SECURE=1 and HTTPS');
 if(!adminAuth.state({headers:{}}).configured&&!process.env.DRAMA_SETUP_TOKEN)throw new Error('Configure DRAMA_SETUP_TOKEN before first public startup');
}

await initializeGeoCountry();
const creatorAuth = createCreatorAuth(store,port);
const finance=createFinance(store,dataDir);

const operatorScope=createOperatorScope(store);
const activityRewards=createActivityRewards(store,operatorScope);
const stageEnrollments=createStageEnrollments(store,operatorScope);
const premiumDispatch=createPremiumDispatch(store,operatorScope,stageEnrollments);
const production = args.includes("--production");
let backupActive = false;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};
function send(res, code, body) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(body));
}
async function body(req) {
  if (Number(req.headers["content-length"] || 0) > 8 * 1024 * 1024) {
    req.resume();
    throw new AppError("请求文件过大", 413);
  }
  if (!String(req.headers["content-type"] || "").includes("application/json"))
    throw new AppError("请使用 JSON 格式提交数据", 415);
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8 * 1024 * 1024) throw new AppError("请求文件过大", 413);
    chunks.push(chunk);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("Expected object");
    return parsed;
  } catch {
    throw new AppError("请求内容不是有效 JSON");
  }
}
function validateOrigin(req) {
  if (req.headers["x-workspace-request"] !== "1")
    throw new AppError("请求验证失败", 403);
  const origin = req.headers.origin;
  if (origin) {
    let source;
    try {
      source = new URL(origin);
    } catch {
      throw new AppError("来源无效", 403);
    }
    if (source.host !== req.headers.host)
      throw new AppError("不允许跨站修改工作区", 403);
  }
}
function imageType(buf) {
  if (
    buf.length > 8 &&
    buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return ["image/png", ".png"];
  if (buf.length > 3 && buf[0] === 255 && buf[1] === 216 && buf[2] === 255)
    return ["image/jpeg", ".jpg"];
  if (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  )
    return ["image/webp", ".webp"];
  if (["GIF87a", "GIF89a"].includes(buf.toString("ascii", 0, 6)))
    return ["image/gif", ".gif"];
  throw new AppError("仅支持有效的 PNG、JPEG、WebP 或 GIF 图片");
}
async function upload(input, assignmentId, actor) {
  if (
    typeof input.data !== "string" ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(input.data)
  )
    throw new AppError("图片数据无效");
  const buffer = Buffer.from(input.data, "base64");
  if (buffer.length < 20 || buffer.length > 5 * 1024 * 1024)
    throw new AppError("每张图片必须在 5 MB 以内");
  const [mime, extension] = imageType(buffer),
    filename = randomUUID() + extension,
    path = "/uploads/" + filename;
  const disk = join(dataDir, "uploads", filename);
  await writeFile(disk, buffer, { flag: "wx" });
  try {
    const meta = {
      name: String(input.name || "发布截图").slice(0, 150),
      mime,
      size: buffer.length,
      path,
    };
    return actor ? store.audited(actor,"cover.upload","",()=>store.addUpload(assignmentId,meta),{name:meta.name}) : store.addUpload(assignmentId,meta);
  } catch (e) {
    await unlink(disk).catch(() => {});
    throw e;
  }
}
const quote = (value) => '"' + String(value ?? "").replace(/"/g, '""') + '"';
async function validateCoverPath(cover) {
  if(typeof cover !== "string" || !cover.startsWith("/art/"))return;
  if(!/^\/art\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp|gif)$/.test(cover) || !(await stat(join(root,"public",cover.slice(1))).catch(()=>null))?.isFile())throw new AppError("封面文件不存在，请重新选择或上传");
}
async function api(req, res, url, inScope=false) {
  const p = url.pathname,
    method = req.method;
  if(p==='/api/stage-finance'&&method==='GET'){
    const user=creatorAuth.require(req),settings=store.commissionSettings();
    return store.asUser(user.id,()=>{const summary=store.summary();return send(res,200,{...summary,commissionPolicy:settings,paymentMode:'manual',stageTwoEligible:summary.assignments.some(a=>a.status==='completed'&&a.task.stage===1),stageThreeEligible:stageEnrollments.status(user.id).enrollment?.status==='approved'});});
  }
  if(['/api/stage-three/premium-reveal','/api/stage-three/example'].includes(p))throw new AppError('此旧版功能已停用，请使用阶段任务',410);
  if(p==='/api/stage-three/enrollment'||p==='/api/stage-three/access'){
    const user=creatorAuth.require(req);
    if(method==='GET')return send(res,200,p.endsWith('/access')?stageEnrollments.access(user.id):stageEnrollments.status(user.id));
    if(method==='POST'&&p.endsWith('/enrollment')){validateOrigin(req);await body(req);return send(res,200,stageEnrollments.apply(user.id));}
    throw new AppError('接口不存在',404);
  }
  if(p==='/api/journey'){creatorAuth.require(req);throw new AppError('旧版阶段进度已停用，请读取阶段任务',410);}
  if(p==='/api/auth/session'&&method==='GET')return send(res,200,{user:creatorAuth.current(req)});
  if(['/api/auth/register','/api/auth/login','/api/auth/logout'].includes(p)&&method==='POST'){
    validateOrigin(req);const input=await body(req);
    if(p.endsWith('logout')){creatorAuth.logout(req);res.setHeader('Set-Cookie',creatorAuth.cookie(''));return send(res,200,{ok:true});}
    const result=await creatorAuth[p.endsWith('register')?'register':'login'](req,input);
    res.setHeader('Set-Cookie',creatorAuth.cookie(result.token));return send(res,p.endsWith('register')?201:200,{user:result.user});
  }
  const management=p.startsWith('/api/admin/')||p.startsWith('/api/manage/')||['/api/export/backup','/api/export/workspace','/api/assets'].includes(p)||(p==='/api/export/ledger'&&url.searchParams.get('scope')==='all')||(method!=='GET'&&(p==='/api/tasks'||/^\/api\/tasks\/[^/]+(?:\/active|\/materials)?$/.test(p)||p.startsWith('/api/materials/')||/^\/api\/assignments\/[^/]+\/review$/.test(p)));
  const publicRead=method==='GET'&&(p==='/api/health'||p==='/api/tasks'||/^\/api\/tasks\/[^/]+(?:\/materials)?$/.test(p));
  if(!inScope&&publicRead){const user=creatorAuth.current(req);return store.asUser(user?.id||'guest',()=>api(req,res,url,true));}
  if(!inScope&&!management&&!publicRead){const user=creatorAuth.require(req);return store.asUser(user.id,()=>api(req,res,url,true));}
  if(management&&!p.startsWith('/api/admin/'))adminAuth.requireAdmin(req);
  if(p.startsWith('/api/finance')){
    const user=creatorAuth.require(req);
    const photo=p.match(/^\/api\/finance\/identity\/([^/]+)\/photos\/(front|back)$/);
    if(photo&&method==='GET'){const image=finance.photo('creator',photo[1],photo[2],user.id);res.writeHead(200,{'Content-Type':image.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});return res.end(image.bytes);}
    if(p==='/api/finance'&&method==='GET')return send(res,200,finance.snapshot(user.id));
    validateOrigin(req);const input=await body(req);
    if(method==='POST'&&p==='/api/finance/identity')return send(res,201,finance.identity(user.id,input));
    if(method==='POST'&&p==='/api/finance/cards')return send(res,201,finance.card(user.id,input));
    if(method==='POST'&&p==='/api/finance/requests')return send(res,201,finance.apply(user.id,input));
    throw new AppError('接口不存在',404);
  }
  if (p === "/api/admin/session" && method === "GET") return send(res,200,adminAuth.state(req));
  if (["/api/admin/setup","/api/admin/login","/api/admin/logout"].includes(p) && method === "POST") {
    validateOrigin(req);
    const input=await body(req);
    if(p.endsWith("logout")){adminAuth.logout(req);res.setHeader("Set-Cookie",adminAuth.cookie(""));return send(res,200,{ok:true});}
    if(p.endsWith('setup')&&process.env.DRAMA_SETUP_TOKEN){const digest=x=>createHash('sha256').update(x).digest();if(!timingSafeEqual(digest(String(input.setupToken||'')),digest(process.env.DRAMA_SETUP_TOKEN)))throw new AppError('初始化令牌不正确',403);}
    const result=p.endsWith("setup")?adminAuth.setup(input):adminAuth.login(req,input);
    res.setHeader("Set-Cookie",adminAuth.cookie(result.token));return send(res,200,{username:result.username,role:result.role||'super',id:result.id||'super'});
  }
  const operator=adminAuth.current(req);
  if(management&&operator)operatorScope.guard(operator,p,method);
  if(p.startsWith("/api/admin/")) {
    const actor=adminAuth.requireAdmin(req);
    if(p==='/api/admin/commission-policy'){
      adminAuth.requireSuper(req);
      if(method==='GET')return send(res,200,{...store.commissionSettings(),paymentMode:'manual'});
      if(method==='POST'){validateOrigin(req);const input=await body(req);return send(res,200,store.audited(actor,'commission.policy','global',()=>store.setCommissionRate(input.rate),{rate:input.rate}));}
      throw new AppError('接口不存在',404);
    }
    if(p==='/api/admin/agents'&&method==='GET'){adminAuth.requireSuper(req);return send(res,200,{agents:adminAuth.agents().map(a=>({...a,customers:store.db.prepare('SELECT COUNT(*) AS n FROM creator_accounts c JOIN invitations i ON i.id=c.invite_id WHERE i.owner_id=?').get(a.id).n}))});}
    if(p==='/api/admin/agents'&&method==='POST'){adminAuth.requireSuper(req);validateOrigin(req);return send(res,201,adminAuth.createAgent(actor,await body(req)));}
    const agentState=p.match(/^\/api\/admin\/agents\/([^/]+)\/state$/);
    if(agentState&&method==='PATCH'){adminAuth.requireSuper(req);validateOrigin(req);return send(res,200,adminAuth.setAgent(actor,agentState[1],await body(req)));}

    if(p==='/api/admin/premium-dispatch'&&method==='GET')return send(res,200,premiumDispatch.list(operator));
    const premiumConfig=p.match(/^\/api\/admin\/premium-dispatch\/([^/]+)$/);
    if(premiumConfig&&method==='POST'){validateOrigin(req);return send(res,200,premiumDispatch.save(operator,premiumConfig[1],await body(req)));}
    if(p==='/api/admin/stage-enrollments'&&method==='GET')return send(res,200,{enrollments:stageEnrollments.list(operator)});
    const enrollmentReview=p.match(/^\/api\/admin\/stage-enrollments\/([^/]+)\/review$/);
    if(enrollmentReview&&method==='POST'){validateOrigin(req);return send(res,200,stageEnrollments.review(operator,enrollmentReview[1],await body(req)));}
    if(p==='/api/admin/activity-rewards' &&method==='GET')return send(res,200,activityRewards.snapshot(operator));
    if(p==='/api/admin/activity-rewards'&&method==='POST'){validateOrigin(req);return send(res,201,activityRewards.create(operator,await body(req)));}
    const activity=p.match(/^\/api\/admin\/activity-rewards\/([^/]+)\/(grant|state)$/);
    if(activity&&method==='POST'){validateOrigin(req);return send(res,200,activityRewards[activity[2]](operator,activity[1],await body(req)));}
    const identityPhoto=p.match(/^\/api\/admin\/finance\/identity\/([^/]+)\/photos\/(front|back)$/);
    if(identityPhoto&&method==='GET'){const image=finance.photo(actor,identityPhoto[1],identityPhoto[2]);res.writeHead(200,{'Content-Type':image.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});return res.end(image.bytes);}
    if(p==='/api/admin/finance'&&method==='GET')return send(res,200,operatorScope.finance(operator,finance.admin()));
    const financial=p.match(/^\/api\/admin\/finance\/(identity|bank|fund|account)\/([^/]+)\/(review|reveal|adjust|freeze)$/);
    if(financial&&method==='POST'){validateOrigin(req);const input=await body(req),[,type,id,action]=financial;
      if(action==='reveal')return send(res,200,finance.reveal(actor,type,id));
      if(action==='adjust'&&type==='account'){adminAuth.requireSuper(req);return send(res,200,finance.adjust(actor,id,input));}
      if(action==='freeze'&&type==='account')return send(res,200,finance.freeze(actor,id,input));
      if(action==='review'&&['identity','bank','fund'].includes(type))return send(res,200,finance.review(actor,type,id,input));
      throw new AppError('接口不存在',404);
    }
    if(method==='GET'&&p==='/api/admin/accounts')return send(res,200,{users:customerDirectory(store,creatorAuth,operatorScope,operator),invitations:creatorAuth.invitations(operator.role==='agent'?operator.id:undefined)});
    const customerAction=p.match(/^\/api\/admin\/accounts\/([^/]+)\/(notes|revoke-sessions)$/);
    if(customerAction&&method==='POST'){
      operatorScope.assertUser(operator,customerAction[1]);validateOrigin(req);
      const input=await body(req);
      return send(res,200,customerAction[2]==='notes'?creatorAuth.updateNote(actor,customerAction[1],input):creatorAuth.revokeSessions(actor,customerAction[1]));
    }
    if(method==='POST'&&p==='/api/admin/invitations'){validateOrigin(req);const input=await body(req),count=Number(input.count??1);if(!Number.isInteger(count)||count<1||count>20)throw new AppError('每次可生成 1–20 个邀请码');const codes=store.audited(actor,'invite.batch',operator.id,()=>Array.from({length:count},()=>creatorAuth.createInvite(actor,input,operator.id)),{count});return send(res,201,{...codes[0],codes});}
    const revoke=p.match(/^\/api\/admin\/invitations\/([^/]+)\/revoke$/);
    if(method==='POST'&&revoke){validateOrigin(req);await body(req);return send(res,200,creatorAuth.revoke(actor,revoke[1]));}
    if(method === "GET" && p === "/api/admin/bootstrap") {
      const summary=operatorScope.summary(operator);
      const tasks=operator.role==='super'?store.allTasks():summary.tasks,materials=tasks.flatMap(t=>store.listMaterials(t.id,true));
      const storage=store.db.prepare("SELECT (SELECT COALESCE(SUM(size),0) FROM uploads)+(SELECT COALESCE(SUM(size),0) FROM materials) AS mediaBytes").get();
      const database=await Promise.all(["workspace.sqlite","workspace.sqlite-wal"].map(name=>stat(join(dataDir,name)).then(s=>s.size).catch(()=>0)));
      return send(res,200,{...summary,legacy:operator.role==='super'?store.asUser('legacy',()=>store.summary()):summary,creators:operatorScope.filterUsers(operator,creatorAuth.users()),tasks,materials:operator.role==='super'?materials:[],audit:store.auditLog().filter(a=>operator.role==='super'||a.actor===actor),admin:{username:actor,role:operator.role,id:operator.id},system:{version:"2.0.0",node:process.version,uptime:Math.floor(process.uptime()),databaseBytes:database.reduce((a,b)=>a+b,0),mediaBytes:storage.mediaBytes,mode:"local-workspace"}});
    }
    if(method === "POST" && p === "/api/admin/integrity") {
      validateOrigin(req);await body(req);
      return send(res,200,store.audited(actor,"system.integrity","workspace",()=>{
        const database=store.db.prepare("PRAGMA integrity_check").get().integrity_check==="ok",relations=store.db.prepare("PRAGMA foreign_key_check").all().length===0;
        const balances=new Map();let ledger=true;for(const r of store.db.prepare("SELECT * FROM ledger ORDER BY id").all()){const balance=(balances.get(r.owner_id)||0)+r.amount;balances.set(r.owner_id,balance);if(balance!==r.balance_after)ledger=false;}
        return {ok:database&&relations&&ledger,checks:{database,relations,ledger},checkedAt:new Date().toISOString()};
      }));
    }
    if(method === "PATCH" && p === "/api/admin/creator") {validateOrigin(req);const input=await body(req);return send(res,200,store.audited(actor,"creator.update","1",()=>store.profile(input)));}
    throw new AppError("接口不存在",404);
  }
  if (method === "GET") {
    if (p === "/api/health")
      return send(res, 200, {
        ok: true,
        version: "2.0.0",
        storage: "sqlite",
        mode: "local-workspace",
      });
    if (p === "/api/bootstrap") return send(res, 200, store.summary());
    if (p === "/api/export/backup") {
      const actor=adminAuth.requireAdmin(req);
      if (backupActive) throw new AppError("正在生成备份，请稍后重试", 409);
      backupActive = true;
      try { await streamBackup(dataDir, join(root, "work"), res);store.audited(actor,"system.backup","workspace",()=>null);return; }
      finally { backupActive = false; }
    }
    if (p === "/api/tasks")
      return send(res, 200, { tasks: store.summary().tasks });
    if (p === "/api/manage/tasks") {
      adminAuth.requireAdmin(req);
      return send(res, 200, { tasks: store.allTasks() });
    }
    const taskMaterials = p.match(/^\/api\/tasks\/([^/]+)\/materials$/);
    if (taskMaterials) {
      if(url.searchParams.get("all")==="1")adminAuth.requireAdmin(req);
      return send(res, 200, {
        materials: store.listMaterials(
          taskMaterials[1],
          url.searchParams.get("all") === "1",
        ),
      });
    }
    if (p === "/api/export/workspace") {
      const actor=adminAuth.requireAdmin(req);
      store.audited(actor,"system.export","workspace",()=>null);
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="drama-workspace.json"',
        "Cache-Control": "no-store",
      });
      return res.end(
        JSON.stringify(
          {
            version: 2,
            exportedAt: new Date().toISOString(),
            ...store.summary(),
          },
          null,
          2,
        ),
      );
    }
    if (p === "/api/export/ledger") {
      const rows = url.searchParams.get('scope')==='all'?operatorScope.summary(operator).ledger:store.summary().ledger;
      const safe = (v) => (/^[=+\-@\t\r]/.test(String(v)) ? "'" + v : v);
      const csv =
        "\uFEFF" +
        [
          ["流水编号", "时间", "类型", "金额 USD", "变动后余额 USD", "备注"]
            .map(quote)
            .join(","),
          ...rows.map((r) =>
            [
              r.id,
              r.created_at,
              r.kind,
              (r.amount / 100).toFixed(2),
              (r.balance_after / 100).toFixed(2),
              safe(r.note),
            ]
              .map(quote)
              .join(","),
          ),
        ].join("\r\n");
      res.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="drama-ledger.csv"',
        "Cache-Control": "no-store",
      });
      return res.end(csv);
    }
    const task = p.match(/^\/api\/tasks\/([^/]+)$/);
    if (task) return send(res, 200, store.getTask(task[1]));
    const a = p.match(/^\/api\/assignments\/([^/]+)$/);
    if (a) return send(res, 200, store.assignment(a[1]));
    throw new AppError("接口不存在", 404);
  }
  validateOrigin(req);
  if (backupActive) throw new AppError("正在备份工作区，请稍后保存", 409);
  const privileged = p === "/api/tasks" || p === "/api/assets" || /^\/api\/tasks\/[^/]+(?:\/active|\/materials)?$/.test(p) || /^\/api\/materials\//.test(p) || /^\/api\/assignments\/[^/]+\/review$/.test(p);
  const actor=privileged?adminAuth.requireAdmin(req):null;
  const materialUpload = p.match(/^\/api\/tasks\/([^/]+)\/materials$/);
  if (method === "POST" && materialUpload)
    return send(
      res,
      201,
      await receiveMaterial(req, materialUpload[1], dataDir, store, actor),
    );
  const input = method === "DELETE" ? {} : await body(req);
  const archivedMaterial = p.match(/^\/api\/materials\/([^/]+)$/);
  if (method === "DELETE" && archivedMaterial)
    return send(res, 200, store.audited(actor,"material.archive",archivedMaterial[1],()=>store.archiveMaterial(archivedMaterial[1])));
  const restoredMaterial = p.match(/^\/api\/materials\/([^/]+)\/restore$/);
  if (method === "POST" && restoredMaterial)
    return send(res, 200, store.audited(actor,"material.restore",restoredMaterial[1],()=>store.restoreMaterial(restoredMaterial[1])));
  if (method === "POST" && p === "/api/assignments")
    return send(res, 201, store.claim(input.taskId,input.expected));
  if (method === "POST" && p === "/api/tasks") {
    await validateCoverPath(input.cover);
    return send(res, 201, store.audited(actor,"task.create","",()=>store.createTask(input)));
  }
  if (method === "PATCH" && p === "/api/profile")
    return send(res, 200, store.profile(input));
  if (method === "POST" && p === "/api/notifications/read")
    return send(res, 200, store.readNotifications());
  const noticeRead = p.match(/^\/api\/notifications\/([^/]+)\/read$/);
  if (method === "POST" && noticeRead)
    return send(res, 200, store.readNotifications(noticeRead[1]));
  if (method === "POST" && p === "/api/assets")
    return send(res, 201, await upload(input, null, actor));
  const bookmark = p.match(/^\/api\/tasks\/([^/]+)\/bookmark$/);
  if (method === "POST" && bookmark)
    return send(res, 200, store.bookmark(bookmark[1]));
  const active = p.match(/^\/api\/tasks\/([^/]+)\/active$/);
  if (method === "PATCH" && active) {
    if (typeof input.active !== "boolean")
      throw new AppError("上架状态必须为布尔值");
    return send(res, 200, store.audited(actor,"task."+(input.active?"activate":"pause"),active[1],()=>store.setTaskActive(active[1], input.active)));
  }
  const editTask=p.match(/^\/api\/tasks\/([^/]+)$/);
  if(method === "PATCH" && editTask){await validateCoverPath(input.cover);return send(res,200,store.audited(actor,"task.update",editTask[1],()=>store.updateTask(editTask[1],input),{fields:Object.keys(input)}));}
  const route = p.match(
    /^\/api\/assignments\/([^/]+)\/(draft|uploads|submit|review|cancel)$/,
  );
  if (route) {
    const [, id, action] = route;
    if (action === "draft" && method === "PATCH")
      return send(res, 200, store.saveDraft(id, input));
    if (action === "uploads" && method === "POST")
      return send(res, 201, await upload(input, id));
    if (method === "POST" && action === "submit")
      return send(res, 200, store.submit(id, input));
    if (method === "POST" && action === "review")
      return send(res, 200, store.audited(actor,"review."+input.decision,id,()=>store.review(id, input),{reason:typeof input.reason==="string"?input.reason.slice(0,1000):""}));
    if (method === "POST" && action === "cancel")
      return send(res, 200, store.cancel(id));
  }
  const u = p.match(/^\/api\/uploads\/([^/]+)$/);
  if (method === "DELETE" && u) {
    const deleted = store.removeUpload(u[1]);
    await unlink(join(dataDir, "uploads", deleted.path.split("/").pop())).catch(
      () => {},
    );
    return send(res, 200, { ok: true });
  }
  throw new AppError("接口不存在", 404);
}
let vite;
const server = http.createServer(async (req, res) => {
  try {
    const requestHost = new URL("http://" + req.headers.host).hostname;
    if (
      !["localhost", "127.0.0.1", "[::1]", "terminal.local",...(process.env.DRAMA_ALLOWED_HOSTS||'').split(',').map(x=>x.trim()).filter(Boolean)].includes(
        requestHost,
      )
    )
      throw new AppError("此工作区仅接受本地访问", 403);
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    if (url.pathname.startsWith("/materials/")) {
      if (!["GET", "HEAD"].includes(req.method))
        throw new AppError("不支持此请求方式", 405);
      if(!adminAuth.state(req).authenticated)creatorAuth.require(req);
      const record = store.materialPath(url.pathname);
      if (!record) throw new AppError("素材不存在", 404);
      const filename = url.pathname.slice(11);
      if (!/^[a-f0-9-]+\.(mp4|webm|txt|srt)$/.test(filename))
        throw new AppError("素材不存在", 404);
      const disk = join(dataDir, "materials", filename),
        info = await stat(disk).catch(() => {
          throw new AppError("素材文件不存在", 404);
        });
      let range;
      try {
        range = parseRange(req.headers.range, info.size);
      } catch (e) {
        res.setHeader("Content-Range", `bytes */${info.size}`);
        throw e;
      }
      const headers = {
        "Content-Type": record.mime,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Length": range ? range.end - range.start + 1 : info.size,
      };
      if (range)
        headers["Content-Range"] =
          `bytes ${range.start}-${range.end}/${info.size}`;
      res.writeHead(range ? 206 : 200, headers);
      if (req.method === "HEAD") return res.end();
      return createReadStream(disk, range || {})
        .on("error", () => res.destroy())
        .pipe(res);
    }
    if (url.pathname.startsWith("/uploads/")) {
      const filename = url.pathname.slice(9);
      if (!/^[a-f0-9-]+\.(png|jpg|webp|gif)$/.test(filename))
        throw new AppError("图片不存在", 404);
      const meta=store.db.prepare('SELECT * FROM uploads WHERE path=?').get(url.pathname);
      if(!meta)throw new AppError('图片不存在',404);
      const mediaOperator=adminAuth.current(req);if(meta.assignment_id&&mediaOperator)operatorScope.assertTarget(mediaOperator,'assignment',meta.assignment_id);
      if(meta.assignment_id&&!adminAuth.state(req).authenticated){const user=creatorAuth.require(req);store.asUser(user.id,()=>store.assignment(meta.assignment_id));}
      const bytes = await readFile(join(dataDir, "uploads", filename)).catch(
        () => {
          throw new AppError("图片不存在", 404);
        },
      );
      res.writeHead(200, {
        "Content-Type": types[extname(filename)] || "image/gif",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      });
      return res.end(bytes);
    }
    if (!production) {
      if (["/admin","/admin/"].includes(url.pathname)) req.url="/admin.html";
      return vite.middlewares(req, res, () => {
        res.writeHead(404);
        res.end("Not found");
      });
    }
    await serveStatic(req, res, url, join(root,"dist/client"), types);
  } catch (e) {
    if (res.headersSent) return res.end();
    const status = e.status || 500;
    if (status === 500) console.error(e);
    send(res, status, {
      error: status === 500 ? "服务暂时不可用，请重试" : e.message,
    });
  }
});
if (!production) {
  const { createServer } = await import("vite");
  vite = await createServer({
    root,
    server: { middlewareMode: true, ws: { server, port } },
    appType: "spa",
  });
}
server.listen(port, host, () =>
  console.log(
    `Drama Studio 2.0: http://localhost:${port} · persistent local workspace · ${production ? "production" : "development"}`,
  ),
);
let shuttingDown=false;
async function shutdown() {
  if(shuttingDown)return;
  shuttingDown=true;
  // Let in-flight requests finish before closing SQLite; idle keep-alive sockets
  // do not need to keep a local workspace alive during a requested restart.
  const closed=new Promise(resolve=>server.close(resolve));
  const timeout=setTimeout(()=>server.closeAllConnections(),10000);
  timeout.unref();
  try{
    if (vite) await vite.close();
    await closed;
    clearTimeout(timeout);
    store.close();
    process.exit(0);
  }catch{
    clearTimeout(timeout);
    process.exit(1);
  }
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
