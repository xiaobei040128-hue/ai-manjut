import { useRef, useState } from "react";
import {
  CheckCircledIcon,
  ChevronDownIcon,
  Cross2Icon,
  DownloadIcon,
  FileTextIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { KeyboardInput } from "../mobile";
import { api } from "../api";
import "./help-center.css";
const questions = [
  {
    group: "账号",
    question: "注册需要哪些资料？",
    answer:
      "使用邮箱、8–128 位密码及后台提供的邀请码注册，无需邮箱验证码。首次注册成功立即发放 1 USD 新手奖励，登录不会重复发放。请填写自己的邮箱并保管密码。新生成的邀请码为 8 位，长期有效；停用后不能继续注册。",
  },
  {
    group: "认证",
    question: "实名申请提交后，在哪里看审核状态？",
    answer:
      "在钱包的“账户与资金”中查看。支持居民身份证、护照、驾驶证及正反面照片。成功提交后会显示申请编号；后台可按编号查询。没有成功回执时，请检查必填项与图片是否上传完成。",
  },
  {
    group: "认证",
    question: "为什么客户已提交，后台却找不到？",
    answer:
      "先核对客户与后台是否使用同一平台入口，再核对客户邮箱和申请编号。可在本页的“连接检查”查看当前入口，提交成功的编号也保留在钱包记录中。",
  },
  {
    group: "资金",
    question: "审核中、出款中和已出款有什么区别？",
    answer:
      "审核中表示申请已保存、等待后台核实；出款中表示后台已审核通过、等待登记出款结果；已出款表示后台登记了外部转账凭证。收付款由后台核对实际转账凭证办理。",
  },
  {
    group: "资金",
    question: "钱包余额如何变化？",
    answer:
      "钱包读取当前账号的服务端账本。经后台发放的活动奖励、已核实的充值和提现申请都会保留流水；任务领取时冻结本金，审核通过后返还本金并计入佣金。可按活动奖励、冻结或返还筛选，并查看详情及导出账本。",
  },
  {
    group: "阶段",
    question: "成长阶段与钱包是什么关系？",
    answer:
      "各阶段使用服务端任务与钱包账本。第一阶段任务审核通过后可领取第二阶段任务；第二阶段完成后可报名第三阶段，由后台审核开放。",
  },
  {
    group: "阶段",
    question: "第三阶段的金额基数来自哪里？",
    answer: "任务金额由后台配置，佣金采用统一比例。领取时冻结该金额，并固定本次本金与佣金；审核通过后返还本金和佣金，取消未提交任务则返还本金。",
  },
  {
    group: "资金",
    question: "活动奖励如何领取？",
    answer: "由总后台配置活动奖励与预算，授权发放员核对参与记录后发放。每位客户每个活动限领一次。成功入账后，钱包会显示活动名称、原因和流水；无需先购买。提现仍按现有实名、银行卡和后台审批流程申请。",
  },
  {
    group: "创作",
    question: "创作工作室能做什么？",
    answer:
      "可以编写三段分镜，整理发布文案，播放 18 秒字幕分镜预演，勾选发布检查项，并导出文稿和 1080×1920 PNG 封面。预演不是最终视频，不会自动发布。",
  },
  {
    group: "创作",
    question: "创作草稿保存在哪里？",
    answer:
      "创作工作室的分镜保存在此浏览器，并按当前账号区分。清除浏览器数据或换设备不会自动同步。工作室提供文稿导出，请及时保留；本地分镜不包含在服务器工作区备份中。",
  },
  {
    group: "账号",
    question: "账户被冻结后会怎样？",
    answer:
      "冻结会撤销登录会话，不能登录或办理任务、资金申请。历史记录仍保留。解冻需要后台处理，解冻后原来的申请不会自动通过。",
  },
] as const;
type Diagnostic = {
  checkedAt: string;
  online: boolean;
  service: boolean;
  storage: boolean;
  origin: string;
  browser: string;
  error?: string;
};
export default function HelpCenter({
  onGo,
}: {
  onGo: (page: "wallet" | "tasks" | "planner") => void;
}) {
  const [query, setQuery] = useState(""),
    [group, setGroup] = useState("全部"),
    [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null),
    [busy, setBusy] = useState(false);
  const request = useRef(false);
  const needle = query.trim().toLowerCase();
  const alias =
    (
      { kyc: "实名", passport: "护照", invite: "邀请码" } as Record<
        string,
        string
      >
    )[needle] || needle;
  const results = questions.filter(
    (q) =>
      (group === "全部" || q.group === group) &&
      (!needle ||
        (q.question + q.answer + q.group).toLowerCase().includes(alias)),
  );
  async function check() {
    if (request.current) return;
    request.current = true;
    setBusy(true);
    let storage = false,
      service = false,
      error = "";
    try {
      const key = "drama-diagnostic-" + crypto.randomUUID();
      localStorage.setItem(key, "ok");
      storage = localStorage.getItem(key) === "ok";
      localStorage.removeItem(key);
    } catch {
      /* Report unavailable storage without changing saved drafts. */
    }
    try {
      service = (await api<{ ok: boolean }>("/health")).ok;
    } catch (e) {
      error = (e as Error).message;
    }
    setDiagnostic({
      checkedAt: new Date().toISOString(),
      online: navigator.onLine,
      service,
      storage,
      origin: location.origin,
      browser: navigator.userAgent,
      ...(error ? { error } : {}),
    });
    request.current = false;
    setBusy(false);
  }
  function exportDiagnostic() {
    if (!diagnostic) return;
    const lines = [
      "漫剧 STUDIO · 连接诊断",
      `检查时间：${new Date(diagnostic.checkedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`,
      `访问入口：${diagnostic.origin}`,
      `网络状态：${diagnostic.online ? "在线" : "离线"}`,
      `平台服务：${diagnostic.service ? "可连接" : "连接失败"}`,
      `浏览器存储：${diagnostic.storage ? "可用" : "不可用"}`,
      `浏览器：${diagnostic.browser}`,
      diagnostic.error || "",
      "本文件不包含密码、证件、账户余额、邮箱或邀请码。",
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([lines], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "连接诊断.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="h-center">
      <section className="h-intro">
        <span>HERE TO HELP</span>
        <h2>把问题，留在这一页</h2>
        <p>账号、创作与申请进度，找到清晰的说明。</p>
        <FileTextIcon />
      </section>
      <div className="h-search">
        <MagnifyingGlassIcon />
        <KeyboardInput
          aria-label="搜索帮助"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索认证、审核、草稿…"
        />
        {query && (
          <button aria-label="清空帮助搜索" onClick={() => setQuery("")}>
            <Cross2Icon />
          </button>
        )}
      </div>
      <div className="h-categories">
        {["全部", "账号", "认证", "资金", "阶段", "创作"].map((g) => (
          <button
            key={g}
            aria-pressed={group === g}
            onClick={() => setGroup(g)}
          >
            {g}
          </button>
        ))}
      </div>
      <div className="h-results-heading">
        <h3>常见问题</h3>
        <span>{results.length} 条说明</span>
      </div>
      <section className="h-faq">
        {results.map((q) => (
          <details key={q.question}>
            <summary>
              <span>{q.question}</span>
              <ChevronDownIcon />
            </summary>
            <p>{q.answer}</p>
          </details>
        ))}
        {!results.length && (
          <div className="h-no-results">
            <MagnifyingGlassIcon />
            <h3>没有匹配的说明</h3>
            <p>换一个关键词，或选择其他分类。</p>
            <button
              onClick={() => {
                setQuery("");
                setGroup("全部");
              }}
            >
              查看全部问题
            </button>
          </div>
        )}
      </section>
      <section className="h-shortcuts">
        <h3>直接去办理</h3>
        <div>
          <button onClick={() => onGo("wallet")}>
            <LockClosedIcon />
            <span>查看账户与申请</span>
          </button>
          <button onClick={() => onGo("planner")}>
            <FileTextIcon />
            <span>打开创作工作室</span>
          </button>
        </div>
      </section>
      <section className="h-diagnostic">
        <div className="h-results-heading">
          <h3>连接检查</h3>
          <button disabled={busy} onClick={check}>
            <ReloadIcon className={busy ? "h-spinning" : ""} />
            {busy ? "检查中" : "检查连接"}
          </button>
        </div>
        <p>遇到页面不同步时，先检查当前入口和平台服务。</p>
        {diagnostic && (
          <>
            <dl>
              <dt>当前入口</dt>
              <dd>{diagnostic.origin}</dd>
              <dt>平台服务</dt>
              <dd className={diagnostic.service ? "ok" : "warning"}>
                {diagnostic.service ? "连接正常" : "暂时无法连接"}
              </dd>
              <dt>草稿存储</dt>
              <dd className={diagnostic.storage ? "ok" : "warning"}>
                {diagnostic.storage ? "此浏览器可用" : "请导出文稿保留内容"}
              </dd>
              <dt>检查时间</dt>
              <dd>
                {new Date(diagnostic.checkedAt).toLocaleTimeString("zh-CN", {
                  timeZone: "Asia/Shanghai",
                })}
              </dd>
            </dl>
            {diagnostic.error && (
              <p role="status" className="h-diagnostic-error">
                {diagnostic.error}
              </p>
            )}
            <button className="h-export" onClick={exportDiagnostic}>
              <DownloadIcon />
              导出本次连接诊断
            </button>
          </>
        )}
      </section>
      <footer className="h-footer">
        <CheckCircledIcon />
        说明基于当前本地版本，不代表接入第三方支付或身份核验。
      </footer>
    </div>
  );
}
