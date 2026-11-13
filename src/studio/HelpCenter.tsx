import {translateText as tx,localizeNode as lx} from "../i18n/translate";
import { useState } from "react";
import {
  CheckCircledIcon,
  ChevronDownIcon,
  Cross2Icon,
  FileTextIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
} from "@radix-ui/react-icons";
import { KeyboardInput } from "../mobile";
import "./help-center.css";
const questions = [
  {group:"账号",question:"资金密码如何设置或修改？",answer:"在“我的 → 账号与安全 → 资金密码”操作。首次设置需验证登录密码，之后修改需验证原资金密码。资金密码用于确认提现，忘记时可联系支持协助处理。"},
  {
    group: "账号",
    question: "注册需要哪些资料？",
    answer:
      "设置用户名，并使用邮箱或手机号、密码和有效邀请码创建账号。",
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
      "充值到账、活动奖励、任务占用、返还和佣金都会记入钱包。任务领取后可查看购买金额，余额不足时会显示待补金额；完成任务后可在钱包查看结算记录。",
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
  {group:"资金",question:"如何申请提现？",answer:"如果当前还有未处理的任务，请先完成任务后再申请提现。设置资金密码并添加本人银行卡后，可在钱包提交申请。"},
] as const;
export default function HelpCenter({
  onGo,
}: {
  onGo: (page: "wallet" | "tasks") => void;
}) {
  const [query, setQuery] = useState(""),
    [group, setGroup] = useState("全部");
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
      <footer className="h-footer">
        <CheckCircledIcon />{tx("申请进度与资金记录以账户页面显示为准。")}</footer>
    </div>
  );
}
