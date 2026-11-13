import {adminGlobalRecords} from './admin-global-records.mjs';
import {adminReviewNotices,initializeAdminReviewNotices} from './admin-review-notices.mjs';
import {createAdminCustomerHistory} from './admin-customer-history.mjs';
import {createCustomerRecords} from './customer-records.mjs';
import {createCustomerLedger} from './customer-ledger.mjs';
import {sendJson} from './json-response.mjs';
import {createTaskHistory} from './task-history.mjs';
import {taskCoverPreview} from './task-covers.mjs';
import {initializeReputation,adjustReputation,reputationHistory} from './reputation.mjs';
import {referralSummary,referralPolicy,saveReferralPolicy} from './referrals.mjs';
import {dispatchDefaults,saveDispatchDefaults} from './dispatch-defaults.mjs';
import {earlyTaskHistory} from './early-task-history.mjs';
import {createEarlyStagePolicy} from './early-stage-policy.mjs';
import {createScopedDepositChannels} from './scoped-deposit-channels.mjs';
import {createAgentPermissions,agentPermissionDefinitions} from './agent-permissions.mjs';
import {createDepositChannels} from './deposit-channels.mjs';
import {createFundPassword} from './fund-password.mjs';
import {customerOverview} from './customer-overview.mjs';
import {createPlanDispatch} from './plan-dispatch.mjs';
import {rememberCustomerTimeZone} from './customer-clock.mjs';
import {customerJourneyProgress} from './customer-journey-progress.mjs';
import {createThirdCopyright} from './third-copyright.mjs';
import {syncStoryTasks} from './sync-story-tasks.mjs';
import {createStageJourney} from './stage-journey.mjs';
import {createCustomerTaskReset} from './customer-task-reset.mjs';
import {createStageDispatch} from './stage-dispatch.mjs';
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
const customerLedger=createCustomerLedger(store);
const customerRecords=createCustomerRecords(store);
function requireCreator(req){const user=creatorAuth.require(req);req.authorizedCreator=user.id;return user;}
const finance=createFinance(store,dataDir);
initializeAdminReviewNotices(store.db);
const depositChannels=createDepositChannels(store);
const scopedDepositChannels=createScopedDepositChannels(store,depositChannels);
const fundPassword=createFundPassword(store);

const operatorScope=createOperatorScope(store);
const adminCustomerHistory=createAdminCustomerHistory(store,operatorScope);
const agentPermissions=createAgentPermissions(store);
const activityRewards=createActivityRewards(store,operatorScope);
const stageEnrollments=createStageEnrollments(store,operatorScope);
const premiumDispatch=createPremiumDispatch(store,operatorScope);
const planDispatch=createPlanDispatch(store,operatorScope);
const stageDispatch=createStageDispatch(store);
const taskReset=createCustomerTaskReset(store,stageDispatch);
const thirdCopyright=createThirdCopyright(store);
const stageJourney=createStageJourney(store);
function stageFinanceSnapshot(userId){return store.asUser(userId,()=>{const summary=stageDispatch.visible(userId,store.summary()),journey=stageJourney.snapshot(userId);return {...summary,offer:stageDispatch.pending(userId),journey,commissionPolicy:store.commissionSettings(),dispatch:store.dispatchStatus(),paymentMode:'manual',stageTwoEligible:journey.newcomer.complete,stageThreeEligible:true};});}
// Task operations return only the state used by the task screen. Legacy clients keep full snapshots.
const taskCard=t=>({id:t.id,title:t.title,description:t.description,cover:t.cover,genre:t.genre,premium:t.premium,stage:t.stage,deposit:t.deposit,commission:t.commission,commission_rate_bps:t.commission_rate_bps});
const cardOffer=o=>o?{id:o.id,stage:o.stage,reservedAmount:o.reservedAmount,task:taskCard(o.task)}:null;
const taskAssignment=a=>({id:a.id,owner_id:a.owner_id,status:a.status,created_at:a.created_at,reviewed_at:a.reviewed_at,task:taskCard(a.task)});
const taskHistory=createTaskHistory(store,taskAssignment);
function taskViewSnapshot(userId,{preview=false,knownCover='',roundOnly=false,assignmentId}={}){return store.asUser(userId,()=>{const dispatch=store.dispatchStatus({totals:!roundOnly}),summary=store.summary({taskView:true,...(roundOnly?{assignmentIds:taskHistory.scope(userId,dispatch,assignmentId)}:{})}),offer=cardOffer(stageDispatch.pending(userId)),current=offer?.task||summary.assignments.find(a=>['active','review','revision'].includes(a.status))?.task,cover=preview?taskCoverPreview(current?.cover,knownCover):null;return {ownerId:userId,wallet:summary.wallet,assignments:summary.assignments.filter(a=>a.task.stage===3).map(taskAssignment),offer,dispatch,...(roundOnly?{historyTotal:taskHistory.total(userId)}:{}),...(cover?{coverPreview:cover}:{})};});}

syncStoryTasks(store);
initializeReputation(store.db);
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
  ".wav": "audio/wav",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};
const send=sendJson;
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
    return authorizeBody(req,parsed);
  } catch(e) {
    if(e instanceof AppError)throw e;
    throw new AppError("请求内容不是有效 JSON");
  }
}
function authorizeBody(req,input){
  if(req.authorizedCreator){const expected=req.authorizedCreator;if(requireCreator(req).id!==expected)throw new AppError('登录已过期，请重新登录',401);}
  if(req.authorizedOperator){const live=adminAuth.current(req);if(!live||live.id!==req.authorizedOperator.id)throw new AppError('请先登录管理后台',401);operatorScope.guard(live,new URL(req.url,'http://localhost').pathname,req.method);}
  return input;
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
  if(!/^\/(?:art|stories)\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp|gif)$/.test(cover) || !(await stat(join(root,"public",cover.slice(1))).catch(()=>null))?.isFile())throw new AppError("封面文件不存在，请重新选择或上传");
}
async function api(req, res, url, inScope=false) {
  const p = url.pathname,
    method = req.method;
  const expectedCreator=req.headers['x-creator-account'];
  if(expectedCreator&&!p.startsWith('/api/admin/')&&!['/api/auth/login','/api/auth/register','/api/health'].includes(p)){
    const current=creatorAuth.current(req);
    if(!current||current.id!==expectedCreator)throw new AppError('登录已过期，请重新登录',401);
    rememberCustomerTimeZone(store.db,current.id,req.headers['x-creator-timezone']);
  }
  if(p.startsWith('/api/stage-journey')){
    const user=requireCreator(req);
    if(p==='/api/stage-journey/history'&&method==='GET')return send(res,200,[]);
    if(method==='POST')throw new AppError('旧阶段已停用，请进入当前任务',410);
    if(p==='/api/stage-journey'&&method==='GET')return send(res,200,stageJourney.snapshot(user.id));
    if(method==='POST'){
      validateOrigin(req);const input=await body(req);
      if(p==='/api/stage-journey/identity-reward')return send(res,200,stageJourney.identityReward(user.id,input));
      if(p==='/api/stage-journey/binding-completion')return send(res,200,stageJourney.bindingCompletion(user.id));
      if(p==='/api/stage-journey/take')return send(res,200,stageJourney.take(user.id));
      if(p==='/api/stage-journey/cover/purchase')return send(res,200,stageJourney.purchaseCover(user.id,input));
      if(p==='/api/stage-journey/cover/submit')return send(res,200,stageJourney.submitCover(user.id,input));
      if(p==='/api/stage-journey/sync')return send(res,200,stageJourney.sync(user.id));
      if(p==='/api/stage-journey/reveal')return send(res,200,stageJourney.reveal(user.id));
      if(p==='/api/stage-journey/license/cancel')throw new AppError('已领取的任务无法取消，请继续完成当前任务',409);
      if(p==='/api/stage-journey/license/purchase')return send(res,200,stageJourney.purchaseLicense(user.id,input));
      if(p==='/api/stage-journey/submit')return send(res,200,stageJourney.submit(user.id,input));
      if(p==='/api/stage-journey/skip-withdrawal')return send(res,200,stageJourney.skipWithdrawal(user.id,input));
    }
    throw new AppError('接口不存在',404);
  }
  if(p==='/api/customer-records'&&method==='GET'){const user=requireCreator(req);return send(res,200,customerRecords.page(user.id,Object.fromEntries(url.searchParams)));}
  if(p==='/api/customer-ledger'&&method==='GET'){const user=requireCreator(req);return send(res,200,customerLedger.page(user.id,Object.fromEntries(url.searchParams)));}
  if(p==='/api/referrals'&&method==='GET'){const user=requireCreator(req);return send(res,200,referralSummary(store,user.id));}
  if(p==='/api/stage-finance/history'&&method==='GET'){const user=requireCreator(req);return send(res,200,taskHistory.page(user.id,url.searchParams.get('cursor')||''));}
  if(p==='/api/stage-finance'&&method==='GET'){
    const user=requireCreator(req),settings=store.commissionSettings();
    return store.asUser(user.id,()=>{return send(res,200,url.searchParams.get('view')==='task'?taskViewSnapshot(user.id,{preview:url.searchParams.get('preview')==='1',knownCover:url.searchParams.get('coverKnown')||'',roundOnly:url.searchParams.get('roundOnly')==='1',assignmentId:url.searchParams.get('assignment')||undefined}):stageFinanceSnapshot(user.id));});
  }
  if(p==='/api/stage-finance/license'&&method==='GET'){
    const user=requireCreator(req);return send(res,200,thirdCopyright.snapshot(user.id,url.searchParams.get('assignment')));
  }
  if(p==='/api/stage-finance/license/complete'&&method==='POST'){
    const user=requireCreator(req);validateOrigin(req);const input=await body(req),result=thirdCopyright.complete(user.id,input);return send(res,200,input.taskView===true?{...result,snapshot:taskViewSnapshot(user.id,{roundOnly:input.roundOnly===true})}:result);
  }
  if(['/api/stage-finance/draw','/api/stage-finance/accept','/api/stage-finance/reserve','/api/stage-finance/discard'].includes(p)&&method==='POST'){
    const user=requireCreator(req);validateOrigin(req);const input=await body(req);
    if(p.endsWith('/discard'))throw new AppError('已领取的任务无法取消，请继续完成当前任务',409);
    if(p.endsWith('/reserve')){const offer=stageDispatch.reserve(user.id,input.offerId);return send(res,200,input.includeSnapshot===true?{offer,snapshot:input.taskView===true?taskViewSnapshot(user.id,{roundOnly:input.roundOnly===true}):stageFinanceSnapshot(user.id)}:offer);}
    if(p.endsWith('/draw')&&input.stage!==3)throw new AppError('请在当前成长计划中继续探索',403);
    if(p.endsWith('/draw')&&input.stage===1&&stageJourney.snapshot(user.id).onboarding.step!==2)throw new AppError('请先完成当前任务',403);
    const result=p.endsWith('/draw')?stageDispatch.draw(user.id,input.stage):stageDispatch.accept(user.id,input.offerId,input.expected);
    if(p.endsWith('/accept')&&input.taskView===true)return send(res,200,{assignment:result,license:thirdCopyright.snapshot(user.id,result.id),snapshot:taskViewSnapshot(user.id,{roundOnly:input.roundOnly===true})});
    if(p.endsWith('/draw')&&input.includeSnapshot===true&&input.taskView===true){const snapshot=taskViewSnapshot(user.id,{preview:input.coverPreview===true,knownCover:input.coverKnown||'',roundOnly:input.roundOnly===true});return send(res,200,{offer:snapshot.offer,snapshot});}
    return send(res,200,p.endsWith('/draw')&&input.includeSnapshot===true?{offer:result,snapshot:stageFinanceSnapshot(user.id)}:result);
  }
  if(['/api/stage-three/premium-reveal','/api/stage-three/example'].includes(p))throw new AppError('此旧版功能已停用，请使用阶段任务',410);
  if(p==='/api/stage-three/enrollment'||p==='/api/stage-three/access'){
    const user=requireCreator(req);
    if(method==='GET')return send(res,200,p.endsWith('/access')?stageEnrollments.access(user.id):{eligible:true,registrationRequired:false,enrollment:null});
    if(method==='POST'&&p.endsWith('/enrollment'))throw new AppError('报名已停用，注册后可直接进入创作新境',410);
    throw new AppError('接口不存在',404);
  }
  if(p==='/api/journey'){requireCreator(req);throw new AppError('旧版阶段进度已停用，请读取阶段任务',410);}
  if(p==='/api/auth/password'&&method==='POST'){validateOrigin(req);const result=await creatorAuth.changeOwnPassword(req,await body(req));res.setHeader('Set-Cookie',creatorAuth.cookie(''));return send(res,200,result);}
  if(p==='/api/auth/fund-password'){const user=requireCreator(req);if(method==='GET')return send(res,200,fundPassword.state(user.id));if(method==='POST'){validateOrigin(req);return send(res,200,fundPassword.save(user.id,await body(req)));}throw new AppError('接口不存在',404);}
  if(p==='/api/support'&&method==='GET')return send(res,200,{supportUrl:depositChannels.snapshot().supportUrl});
  if(p==='/api/auth/session'&&method==='GET')return send(res,200,{user:creatorAuth.current(req)});
  if(['/api/auth/register','/api/auth/login','/api/auth/logout'].includes(p)&&method==='POST'){
    validateOrigin(req);const input=await body(req);
    if(p.endsWith('logout')){creatorAuth.logout(req);res.setHeader('Set-Cookie',creatorAuth.cookie(''));return send(res,200,{ok:true});}
    const result=await creatorAuth[p.endsWith('register')?'register':'login'](req,input);
    rememberCustomerTimeZone(store.db,result.user.id,req.headers['x-creator-timezone']);
    res.setHeader('Set-Cookie',creatorAuth.cookie(result.token));return send(res,p.endsWith('register')?201:200,{user:result.user,...(result.registrationReward?{registrationReward:result.registrationReward}:{})});
  }
  const management=p.startsWith('/api/admin/')||p.startsWith('/api/manage/')||['/api/export/backup','/api/export/workspace','/api/assets'].includes(p)||(p==='/api/export/ledger'&&url.searchParams.get('scope')==='all')||(method!=='GET'&&(p==='/api/tasks'||/^\/api\/tasks\/[^/]+(?:\/active|\/materials)?$/.test(p)||p.startsWith('/api/materials/')||/^\/api\/assignments\/[^/]+\/review$/.test(p)));
  const publicRead=method==='GET'&&(p==='/api/health'||p==='/api/tasks'||/^\/api\/tasks\/[^/]+(?:\/materials)?$/.test(p));
  if(!inScope&&publicRead){const user=creatorAuth.current(req);return store.asUser(user?.id||'guest',()=>api(req,res,url,true));}
  if(!inScope&&!management&&!publicRead){const user=requireCreator(req);rememberCustomerTimeZone(store.db,user.id,req.headers['x-creator-timezone']);return store.asUser(user.id,()=>api(req,res,url,true));}
  if(management&&!p.startsWith('/api/admin/'))adminAuth.requireAdmin(req);
  if(p.startsWith('/api/finance')){
    const user=requireCreator(req);
    const photo=p.match(/^\/api\/finance\/identity\/([^/]+)\/photos\/(front|back)$/);
    if(photo&&method==='GET'){const image=finance.photo('creator',photo[1],photo[2],user.id);res.writeHead(200,{'Content-Type':image.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});return res.end(image.bytes);}
    if(p==='/api/finance/deposit-channels'&&method==='GET'){const settings=scopedDepositChannels.forCustomer(user.id);return send(res,200,{...settings,channels:settings.channels.filter(c=>c.id==='bank_wire')});}
    if(p==='/api/finance'&&method==='GET')return send(res,200,finance.snapshot(user.id));
    validateOrigin(req);const input=await body(req);
    if(method==='POST'&&p==='/api/finance/identity')throw new AppError('该功能已停用',410);
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
  if(management&&operator){operatorScope.guard(operator,p,method);req.authorizedOperator=operator;}
  if(p.startsWith("/api/admin/")) {
    const actor=adminAuth.requireAdmin(req);
    if(p==='/api/admin/deposit-channels'){if(operator.role==='agent'&&url.searchParams.size)throw new AppError('仅能配置本人归属客户',403);if(method==='GET')return send(res,200,scopedDepositChannels.read(operator));if(method==='POST'){validateOrigin(req);return send(res,200,scopedDepositChannels.save(operator,await body(req)));}}
    if(p==='/api/admin/early-stage-policy'){const target=url.searchParams.get('customer');if(target)operatorScope.assertUser(operator,target);const scope=target?'customer:'+target:operator.role==='super'?'global':'agent:'+operator.id;const rules=createEarlyStagePolicy(store);if(method==='GET')return send(res,200,rules.readFor(scope,target));if(method==='POST'){validateOrigin(req);return send(res,200,rules.save(actor,scope,await body(req)));}}
    if(p==='/api/admin/referral-policy'){adminAuth.requireSuper(req);if(method==='GET')return send(res,200,referralPolicy(store.db));if(method==='POST'){validateOrigin(req);return send(res,200,saveReferralPolicy(store,actor,await body(req)));}throw new AppError('接口不存在',404);}
    if(p==='/api/admin/dispatch-defaults'){
      adminAuth.requireSuper(req);
      if(method==='GET')return send(res,200,dispatchDefaults(store.db));
      if(method==='POST'){validateOrigin(req);return send(res,200,saveDispatchDefaults(store,actor,await body(req)));}
      throw new AppError('接口不存在',404);
    }
    if(p==='/api/admin/commission-policy'){
      adminAuth.requireSuper(req);
      if(method==='GET')return send(res,200,{...store.commissionSettings(),paymentMode:'manual'});
      if(method==='POST'){validateOrigin(req);const input=await body(req);return send(res,200,store.audited(actor,'commission.policy','global',()=>store.setCommissionRate(input.rate,input.revision),{rate:input.rate}));}
      throw new AppError('接口不存在',404);
    }
    if(p==='/api/admin/agents'&&method==='GET'){adminAuth.requireSuper(req);return send(res,200,{agents:adminAuth.agents().map(a=>({...a,customers:store.db.prepare('SELECT COUNT(*) AS n FROM creator_accounts c JOIN invitations i ON i.id=c.invite_id WHERE i.owner_id=?').get(a.id).n}))});}
    if(p==='/api/admin/agents'&&method==='POST'){adminAuth.requireSuper(req);validateOrigin(req);return send(res,201,adminAuth.createAgent(actor,await body(req)));}
    const permissionRoute=p.match(/^\/api\/admin\/agents\/([^/]+)\/permissions$/);if(permissionRoute){adminAuth.requireSuper(req);if(method==='GET')return send(res,200,{...agentPermissions.read(permissionRoute[1]),definitions:agentPermissionDefinitions});if(method==='POST'){validateOrigin(req);return send(res,200,agentPermissions.save(actor,permissionRoute[1],await body(req)));}}
    const agentNameRoute=p.match(/^\/api\/admin\/agents\/([^/]+)\/name$/);
    if(agentNameRoute&&method==='PATCH'){adminAuth.requireSuper(req);validateOrigin(req);return send(res,200,adminAuth.renameAgent(actor,agentNameRoute[1],await body(req)));}
    const agentState=p.match(/^\/api\/admin\/agents\/([^/]+)\/state$/);
    if(agentState&&method==='PATCH'){adminAuth.requireSuper(req);validateOrigin(req);return send(res,200,adminAuth.setAgent(actor,agentState[1],await body(req)));}
    const agentDelete=p.match(/^\/api\/admin\/agents\/([^/]+)$/);
    if(agentDelete&&method==='DELETE'){adminAuth.requireSuper(req);validateOrigin(req);return send(res,200,adminAuth.deleteAgent(actor,agentDelete[1],await body(req)));}

    const resetRoute=p.match(/^\/api\/admin\/customers\/([^/]+)\/task-reset$/);
    if(resetRoute&&method==='GET'){adminAuth.requireSuper(req);return send(res,200,taskReset.preview(resetRoute[1]));}
    if(resetRoute&&method==='POST'){validateOrigin(req);const input=await body(req);adminAuth.requireSuper(req);return send(res,200,taskReset.reset(actor,resetRoute[1],input.token));}
    const planned=p.match(/^\/api\/admin\/plan-dispatch\/([^/]+)$/);if(planned&&method==='GET')return send(res,200,planDispatch.list(operator,planned[1]));if(planned&&method==='POST'){validateOrigin(req);return send(res,200,planDispatch.save(operator,planned[1],await body(req)));}
    if(p==='/api/admin/premium-dispatch'&&method==='GET'){const customer=url.searchParams.get('customer');if(customer)operatorScope.assertUser(operator,customer);const result=premiumDispatch.list(operator);return send(res,200,{...result,customers:customer?result.customers.filter(c=>c.id===customer):result.customers});}
    const premiumConfig=p.match(/^\/api\/admin\/premium-dispatch\/([^/]+)$/);
    if(premiumConfig&&method==='POST'){validateOrigin(req);return send(res,200,premiumDispatch.save(operator,premiumConfig[1],await body(req)));}
    if(p==='/api/admin/stage-enrollments'&&method==='GET')return send(res,200,{enrollments:[]});
    const enrollmentReview=p.match(/^\/api\/admin\/stage-enrollments\/([^/]+)\/review$/);
    if(enrollmentReview&&method==='POST')throw new AppError('阶段报名审批已停用',410);
    if(p==='/api/admin/activity-rewards' &&method==='GET')return send(res,200,activityRewards.snapshot(operator));
    if(p==='/api/admin/activity-rewards'&&method==='POST'){validateOrigin(req);return send(res,201,activityRewards.create(operator,await body(req)));}
    const activity=p.match(/^\/api\/admin\/activity-rewards\/([^/]+)\/(grant|state)$/);
    if(activity&&method==='POST'){validateOrigin(req);return send(res,200,activityRewards[activity[2]](operator,activity[1],await body(req)));}
    const identityPhoto=p.match(/^\/api\/admin\/finance\/identity\/([^/]+)\/photos\/(front|back)$/);
    if(identityPhoto&&method==='GET'){const image=finance.photo(actor,identityPhoto[1],identityPhoto[2]);res.writeHead(200,{'Content-Type':image.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});return res.end(image.bytes);}
    if(p==='/api/admin/finance'&&method==='GET'){const customer=url.searchParams.get('customer');if(customer)operatorScope.assertUser(operator,customer);const allowed=operatorScope.users(operator);return send(res,200,finance.admin(customer?[customer]:allowed?[...allowed]:null));}
    const financial=p.match(/^\/api\/admin\/finance\/(identity|bank|fund|account)\/([^/]+)\/(review|reveal|adjust|freeze)$/);
    if(financial&&method==='POST'){validateOrigin(req);const input=await body(req),[,type,id,action]=financial;
      if(action==='reveal')return send(res,200,finance.reveal(actor,type,id));
      if(action==='adjust'&&type==='account'){operatorScope.assertUser(operator,id);return send(res,200,finance.adjust(actor,id,input));}
      if(action==='freeze'&&type==='account')return send(res,200,finance.freeze(actor,id,input));
      if(action==='review'&&['identity','bank','fund'].includes(type))return send(res,200,finance.review(actor,type,id,input));
      throw new AppError('接口不存在',404);
    }
    if(method==='GET'&&p==='/api/admin/overview')return send(res,200,customerOverview(store,operator));
    if(method==='GET'&&p==='/api/admin/accounts')return send(res,200,{users:customerDirectory(store,creatorAuth,operatorScope,operator,url.searchParams.get('customerType')??'all'),invitations:creatorAuth.invitations(operator.role==='agent'?operator.id:undefined)});
    if(p==='/api/admin/review-notices'&&method==='GET')return send(res,200,adminReviewNotices(store.db,operator));
    const customerHistoryPage=p.match(/^\/api\/admin\/customers\/([^/]+)\/(records|ledger)$/);
    if(customerHistoryPage&&method==='GET')return send(res,200,adminCustomerHistory[customerHistoryPage[2]](operator,customerHistoryPage[1],Object.fromEntries(url.searchParams)));
    const customerPage=p.match(/^\/api\/admin\/customers\/([^/]+)$/);
    if(customerPage&&method==='GET'){const id=customerPage[1];operatorScope.assertUser(operator,id);const customer=customerDirectory(store,creatorAuth,operatorScope,operator,'all',id)[0];if(!customer)throw new AppError('客户不存在',404);const base={customer,reputationHistory:reputationHistory(store.db,id),progress:customer.progress};if(url.searchParams.get('view')==='workspace')return send(res,200,{...base,assignments:[],ledger:[]});const summary=store.summary({owners:[id]});return send(res,200,{...base,assignments:summary.assignments.filter(a=>a.owner_id===id),ledger:summary.ledger.filter(r=>r.owner_id===id)});}
    const reputationAccount=p.match(/^\/api\/admin\/accounts\/([^/]+)\/reputation$/);
    if(reputationAccount){const id=reputationAccount[1];operatorScope.assertUser(operator,id);if(method==='GET'){const account=store.db.prepare('SELECT reputation_score FROM creator_accounts WHERE id=?').get(id);if(!account)throw new AppError('客户不存在',404);return send(res,200,{score:account.reputation_score,history:reputationHistory(store.db,id)});}if(method==='POST'){validateOrigin(req);return send(res,200,adjustReputation(store,operator,id,await body(req),operatorScope));}}
    const customerFundPassword=p.match(/^\/api\/admin\/accounts\/([^/]+)\/fund-password$/);
    if(customerFundPassword){res.setHeader('Cache-Control','no-store');if(method==='GET')return send(res,200,fundPassword.adminState(operator,customerFundPassword[1],operatorScope));if(method==='POST'){validateOrigin(req);return send(res,200,fundPassword.reset(operator,customerFundPassword[1],await body(req),operatorScope));}}
    const customerAction=p.match(/^\/api\/admin\/accounts\/([^/]+)\/(notes|revoke-sessions|customer-type|password)$/);
    if(customerAction&&method==='POST'){
      operatorScope.assertUser(operator,customerAction[1]);validateOrigin(req);
      const input=await body(req);
      if(customerAction[2]==='password'){res.setHeader('Cache-Control','no-store');return send(res,200,await creatorAuth.updatePassword(actor,customerAction[1],input,()=>authorizeBody(req,{})));}
      if(customerAction[2]==='customer-type')return send(res,200,creatorAuth.updateCustomerType(actor,customerAction[1],input));
      return send(res,200,customerAction[2]==='notes'?creatorAuth.updateNote(actor,customerAction[1],input):creatorAuth.revokeSessions(actor,customerAction[1]));
    }
    if(method==='POST'&&p==='/api/admin/invitations'){validateOrigin(req);const input=await body(req),count=Number(input.count??1);if(!Number.isInteger(count)||count<1||count>20)throw new AppError('每次可生成 1–20 个邀请码');const codes=store.audited(actor,'invite.batch',operator.id,()=>Array.from({length:count},()=>creatorAuth.createInvite(actor,input,operator.id)),{count});return send(res,201,{...codes[0],codes});}
    const revoke=p.match(/^\/api\/admin\/invitations\/([^/]+)\/revoke$/);
    if(method==='POST'&&revoke){validateOrigin(req);await body(req);return send(res,200,creatorAuth.revoke(actor,revoke[1]));}
    if(method === "GET" && p === "/api/admin/bootstrap") {
      const view=url.searchParams.get('view');
      if(view==='ledger'||view==='audit'){
        const input=Object.fromEntries(url.searchParams);
        return send(res,200,{...adminGlobalRecords(store,operator,input),tasks:[],materials:[],admin:{username:actor,permissions:operator.permissions}});
      }
      const summary=operatorScope.summary(operator);
      const tasks=operator.role==='super'?store.allTasks():summary.tasks,materials=tasks.flatMap(t=>store.listMaterials(t.id,true));
      const storage=store.db.prepare("SELECT (SELECT COALESCE(SUM(size),0) FROM uploads)+(SELECT COALESCE(SUM(size),0) FROM materials) AS mediaBytes").get();
      const database=await Promise.all(["workspace.sqlite","workspace.sqlite-wal"].map(name=>stat(join(dataDir,name)).then(s=>s.size).catch(()=>0)));
      return send(res,200,{...summary,legacy:operator.role==='super'?store.asUser('legacy',()=>store.summary()):summary,creators:creatorAuth.users(operator.role==='agent'?[...operatorScope.users(operator)]:undefined),tasks,materials:operator.role==='super'?materials:[],audit:store.auditLog().filter(a=>operator.role==='super'||a.actor===actor),admin:{username:actor,role:operator.role,id:operator.id,permissions:operator.permissions},system:{version:"2.0.0",node:process.version,uptime:Math.floor(process.uptime()),databaseBytes:database.reduce((a,b)=>a+b,0),mediaBytes:storage.mediaBytes,mode:process.env.DRAMA_ALLOWED_HOSTS?.trim()?"https-proxy":"local-workspace"}});
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
    if(p==='/api/notifications'){
      const rawBefore=url.searchParams.get('before'),rawLimit=url.searchParams.get('limit'),rawUnread=url.searchParams.get('unread');
      if(rawBefore!==null&&!/^[1-9]\d*$/.test(rawBefore)||rawLimit!==null&&!/^[1-9]\d*$/.test(rawLimit)||rawUnread!==null&&!['0','1'].includes(rawUnread))throw new AppError('无效消息分页参数');
      const page=store.notifications({before:rawBefore===null?undefined:Number(rawBefore),limit:rawLimit===null?20:Number(rawLimit),unread:rawUnread==='1'});const user=requireCreator(req);return send(res,200,{...page,unreadCount:stageDispatch.unread(user.id),notifications:page.notifications.filter(n=>!n.task_id||stageDispatch.allowed(user.id,n.task_id))});
    }
    if (p === "/api/bootstrap") {const user=requireCreator(req);return send(res, 200, {...stageDispatch.visible(user.id,store.summary({workspaceView:url.searchParams.get('view')==='workspace'})),reputationScore:user.reputation_score??100});}
    if (p === "/api/export/backup") {
      const actor=adminAuth.requireAdmin(req);
      if (backupActive) throw new AppError("正在生成备份，请稍后重试", 409);
      backupActive = true;
      try { await streamBackup(dataDir, join(root, "work"), res);store.audited(actor,"system.backup","workspace",()=>null);return; }
      finally { backupActive = false; }
    }
    if (p === "/api/tasks")
      return send(res, 200, { tasks: stageDispatch.visible(creatorAuth.current(req)?.id||'guest',store.summary()).tasks });
    if (p === "/api/manage/tasks") {
      adminAuth.requireAdmin(req);
      return send(res, 200, { tasks: store.allTasks() });
    }
    const taskMaterials = p.match(/^\/api\/tasks\/([^/]+)\/materials$/);
    if (taskMaterials) {
      if(!adminAuth.current(req)&&!stageDispatch.allowed(creatorAuth.current(req)?.id||'guest',taskMaterials[1]))throw new AppError('任务尚未揭晓',404);
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
          ["流水编号", "时间", "类型", "金额", "变动后余额", "备注"]
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
    if (task) {if(!adminAuth.current(req)&&!stageDispatch.allowed(creatorAuth.current(req)?.id||'guest',task[1]))throw new AppError('任务尚未揭晓',404);return send(res, 200, store.getTask(task[1]));}
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
    return send(res, 201, stageDispatch.acceptTask(requireCreator(req).id,input.taskId,input.expected));
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
  if (method === "POST" && bookmark){
    if(!stageDispatch.allowed(requireCreator(req).id,bookmark[1]))throw new AppError("任务尚未揭晓",404);
    return send(res, 200, store.bookmark(bookmark[1]));
  }
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
    if(['draft','uploads','submit','review'].includes(action)&&store.assignment(id).task.stage===3)throw new AppError('此任务通过提交版权码完成，无需截图或人工审核',409);
    if (action === "draft" && method === "PATCH")
      return send(res, 200, store.saveDraft(id, input));
    if (action === "uploads" && method === "POST")
      return send(res, 201, await upload(input, id));
    if (method === "POST" && action === "submit")
      return send(res, 200, store.submit(id, input));
    if (method === "POST" && action === "review")
      return send(res, 200, store.audited(actor,"review."+input.decision,id,()=>store.review(id, input),{reason:typeof input.reason==="string"?input.reason.slice(0,1000):""}));
    if (method === "POST" && action === "cancel")
      throw new AppError('已领取的任务无法取消，请继续完成当前任务',409);
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
  res.requestStartedAt=performance.now();
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
      const materialAdmin=adminAuth.state(req).authenticated;
      if(!materialAdmin)requireCreator(req);
      const record = store.materialPath(url.pathname);
      if (!record || (!materialAdmin && (!record.active||!stageDispatch.allowed(requireCreator(req).id,record.task_id)))) throw new AppError("素材不存在", 404);
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
      if(meta.assignment_id&&!adminAuth.state(req).authenticated){const user=requireCreator(req);store.asUser(user.id,()=>store.assignment(meta.assignment_id));}
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
  const ignoredDevRoots=['work','dist','runtime-data','runtime-geoip','test-results','playwright-report'].map(dir=>join(root,dir).replaceAll('\\','/'));
  vite = await createServer({
    root,
    server: { middlewareMode: true, watch: {ignored: path=>{const candidate=path.replaceAll('\\','/');return ignoredDevRoots.some(dir=>candidate===dir||candidate.startsWith(dir+'/'));}}, ws: { server, port } },
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
