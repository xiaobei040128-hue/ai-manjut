import {translateText as tx,localizeNode as lx} from "../i18n/translate";
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
  {group:"账号",question:"资金密码如何设置或修改？",answer:"在“我的 → 账号与安全 → 资金密码”操作。首次设置需验证登录密码，之后修改需验证原资金密码。资金密码用于确认提现，忘记时可联系支持协助处理。"},
  {
    group: "账号",
    question: "注册需要哪些资料？",
    answer:
      "准备邮箱、8–128位密码和有效邀请码即可注册。注册成功可获得1 USD欢迎奖励，每个账号仅发放一次。",
  },
  {
    group: "认证",
    question: "实名申请提交后，在哪里看审核状态？",
    answer:
      "打开钱包的“实名认证”查看状态。提交姓名、证件类型、号码和所需照片后，请留意审核结果；未通过时可按提示重新提交。",
  },
  {
    group: "认证",
    question: "提交的申请在哪里查看？",
    answer:
      "打开钱包查看申请记录与编号。需要进一步查询时，可向平台提供账号邮箱和申请编号。",
  },
  {
    group: "资金",
    question: "审核中、出款中和已出款有什么区别？",
    answer:
      "审核中：正在核实申请；出款中：正在处理转账；已出款：已登记转账结果。请核对收款账户，实际到账以收款记录为准。",
  },
  {
    group: "资金",
    question: "钱包余额如何变化？",
    answer:
      "充值到账、活动奖励、任务占用、返还和佣金都会记入钱包。任务揭晓时会预留可用余额，确认购买后生成版权码；提交本单版权码完成任务后，购买金额返还，佣金另行入账。",
  },
  {
    group: "任务",
    question: "任务进度在哪里查看？",
    answer:
      "从首页继续当前任务，在“我的任务”查看已购买作品与结算状态。",
  },
  {
    group: "任务",
    question: "作品金额与佣金在哪里查看？",
    answer: "打开当前作品后，可查看作品金额、完成佣金和任务要求；核对后再完成购买。结算记录可在钱包查看。",
  },
  {
    group: "资金",
    question: "活动奖励如何领取？",
    answer: "活动奖励发放后会计入钱包，每个账号每项活动限领一次，无需先购买。可在钱包查看奖励名称与金额，提现进度以提款记录为准。",
  },
  {
    group: "账号",
    question: "账号暂时无法使用怎么办？",
    answer:
      "请按页面提示核对登录信息。若账号受限，可联系支持协助处理；受限期间无法登录或办理资金申请，历史记录仍保留。",
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
  onGo: (page: "wallet" | "tasks") => void;
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
        (q.question + q.answer + q.group + tx(q.question)+tx(q.answer)+tx(q.group)).toLowerCase().includes(alias)),
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
      "AI CREATOR · 连接诊断",
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
        <span>{tx("HERE TO HELP")}</span>
        <h2>{tx("把问题，留在这一页")}</h2>
        <p>{tx("账号、创作与申请进度，找到清晰的说明。")}</p>
        <FileTextIcon />
      </section>
      <div className="h-search">
        <MagnifyingGlassIcon />
        <KeyboardInput
          aria-label={tx("搜索帮助")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tx("搜索认证、审核、提现…")}
        />
        {lx(query && (
          <button aria-label={tx("清空帮助搜索")} onClick={() => setQuery("")}>
            <Cross2Icon />
          </button>
        ))}
      </div>
      <div className="h-categories">
        {lx(["全部", "账号", "认证", "资金", "任务"].map((g) => (
          <button
            key={g}
            aria-pressed={group === g}
            onClick={() => setGroup(g)}
          >
            {lx(g)}
          </button>
        )))}
      </div>
      <div className="h-results-heading">
        <h3>{tx("常见问题")}</h3>
        <span>{lx(results.length)}{tx(" 条说明")}</span>
      </div>
      <section className="h-faq">
        {lx(results.map((q) => (
          <details key={q.question}>
            <summary>
              <span>{lx(q.question)}</span>
              <ChevronDownIcon />
            </summary>
            <p>{lx(q.answer)}</p>
          </details>
        )))}
        {lx(!results.length && (
          <div className="h-no-results">
            <MagnifyingGlassIcon />
            <h3>{tx("没有匹配的说明")}</h3>
            <p>{tx("换一个关键词，或选择其他分类。")}</p>
            <button
              onClick={() => {
                setQuery("");
                setGroup("全部");
              }}
            >{tx("查看全部问题")}</button>
          </div>
        ))}
      </section>
      <section className="h-shortcuts">
        <h3>{tx("直接去办理")}</h3>
        <div>
          <button onClick={() => onGo("wallet")}>
            <LockClosedIcon />
            <span>{tx("查看账户与申请")}</span>
          </button>
          <button onClick={() => onGo("tasks")}>
            <FileTextIcon />
            <span>{tx("查看我的任务")}</span>
          </button>
        </div>
      </section>
      <details className="h-diagnostic"><summary>{tx("连接问题排查")}</summary>
        <div className="h-results-heading">
          <h3>{tx("连接检查")}</h3>
          <button disabled={busy} onClick={check}>
            <ReloadIcon className={busy ? "h-spinning" : ""} />
            {lx(busy ? "检查中" : "检查连接")}
          </button>
        </div>
        <p>{tx("页面无法更新时，可以检查网络连接。")}</p>
        {lx(diagnostic && (
          <>
            <dl>
              <dt>{tx("当前入口")}</dt>
              <dd>{lx(diagnostic.origin)}</dd>
              <dt>{tx("平台服务")}</dt>
              <dd className={diagnostic.service ? "ok" : "warning"}>
                {lx(diagnostic.service ? "连接正常" : "暂时无法连接")}
              </dd>
              <dt>{tx("本地存储")}</dt>
              <dd className={diagnostic.storage ? "ok" : "warning"}>
                {lx(diagnostic.storage ? "此浏览器可用" : "当前无法使用本地存储")}
              </dd>
              <dt>{tx("检查时间")}</dt>
              <dd>
                {lx(new Date(diagnostic.checkedAt).toLocaleTimeString("zh-CN", {
                  timeZone: "Asia/Shanghai",
                }))}
              </dd>
            </dl>
            {lx(diagnostic.error && (
              <p role="status" className="h-diagnostic-error">
                {lx(diagnostic.error)}
              </p>
            ))}
            <button className="h-export" onClick={exportDiagnostic}>
              <DownloadIcon />{tx("导出本次连接诊断")}</button>
          </>
        ))}
      </details>
      <footer className="h-footer">
        <CheckCircledIcon />{tx("申请进度与资金记录以账户页面显示为准。")}</footer>
    </div>
  );
}
