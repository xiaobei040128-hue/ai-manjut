import { useAccountJourney } from "./AccountJourney";
import { freshNewcomer as freshSession } from "./newcomerState";
import { useCallback, useEffect, useState } from "react";
import {
  CheckIcon,
  ArrowRightIcon,
  LockClosedIcon,
  ChevronLeftIcon,
  StarFilledIcon,
  ReaderIcon,
  PersonIcon,
  CardStackIcon,
  ClockIcon,
} from "@radix-ui/react-icons";
import { MobileScroll, BottomSheet } from "../mobile";
import "./newcomer.css";
import JourneyEffects, {
  useJourneyAudio,
  type JourneyEvent,
} from "./JourneyEffects";
const steps = [
  ["注册成功", "平台奖励已入账", "+ $1.00"],
  ["完成实名认证", "人工审批通过后发放", "+ $1.00"],
  ["完成漫剧体验任务", "系统随机派发 · 仅 1 笔", "预付返还"],
  ["绑定提款方式", "本人 Bybit Georgia 账户", "后台审批"],
  ["首次提现到账", "审核中 → 出款中 → 已出款", "真实出款"],
  ["领取毕业奖励", "首次已出款后自动发放", "+ $2.00"],
];
export default function NewcomerDesign() {
  const { newcomer: session, setNewcomer: setSession } = useAccountJourney();
  const [sheet, setSheet] = useState("");
  const { stage, review, paying, method } = session,
    deposit = session.depositCents / 100;
  const setStage = (stage: number) => setSession((old) => ({ ...old, stage }));
  const setReview = (review: boolean) =>
    setSession((old) => ({ ...old, review }));
  const setPaying = (paying: boolean) =>
    setSession((old) => ({ ...old, paying }));
  const setMethod = (method: string) =>
    setSession((old) => ({ ...old, method: method === "btc" ? "btc" : "uid" }));
  const setDeposit = (amount: number) =>
    setSession((old) => ({
      ...old,
      depositCents: amount === 1.88 ? 188 : 168,
    }));
  const [pulse, setPulse] = useState(0),
    [effect, setEffect] = useState<JourneyEvent | null>(null);
  const audio = useJourneyAudio(),
    closeEffect = useCallback(() => setEffect(null), []);
  const currentIndex = stage <= 4 ? stage : stage === 5 ? 4 : 5;
  const completed = stage === 6 ? 6 : currentIndex;
  const balance =
    stage === 1
      ? 1
      : stage === 2 && review
        ? 2 - deposit
        : stage < 5
          ? 2
          : stage === 5
            ? 0
            : 2;
  const titles = [
    "",
    "去完成实名认证",
    "查看我的体验任务",
    "绑定提款方式",
    "申请首次提现",
    paying ? "查看出款进度" : "查看提现审核",
    "查看阶段奖励",
  ];
  function advance() {
    const nonce = pulse + 1;
    setPulse(nonce);
    if (stage === 1 || (stage === 5 && paying)) {
      setEffect({
        kind: "reward",
        amount: stage === 1 ? "+ $1.00" : "+ $2.00",
        title: "平台奖励已到账",
        subtitle:
          stage === 1
            ? "实名认证已通过，奖励已计入。"
            : "首次出款已完成，毕业奖励已计入。",
        nonce,
      });
      audio.play("reward");
    } else if (stage === 2 || stage === 3) {
      setEffect({ kind: "task", nonce });
      audio.play("task");
    }
    if (stage === 4) {
      setStage(5);
      setSheet("");
      return;
    }
    if (stage === 5 && !paying) {
      setPaying(true);
      return;
    }
    setStage(Math.min(6, stage + 1));
    setReview(false);
    setSheet("");
  }

  return (
    <div
      className={
        "studio n-stage" +
        (new URLSearchParams(location.search).get("view") === "app" ||
        window.innerWidth <= 600
          ? " native-mode"
          : "")
      }
    >
      <JourneyEffects event={effect} onClose={closeEffect} />
      <header className="n-header">
        <a href="/?view=app" aria-label="返回应用">
          <ChevronLeftIcon />
        </a>
        <b>
          新手成长计划<small className="s-funds-notice">预览版</small>
        </b>
        <div className="n-header-tools">
          <button
            className="n-sound"
            aria-label={audio.enabled ? "关闭音效" : "开启音效"}
            aria-pressed={audio.enabled}
            onClick={audio.toggle}
          >
            {audio.enabled ? "音效 开" : "音效 关"}
          </button>
          <button onClick={() => setSheet("rules")}>规则</button>
        </div>
      </header>
      <MobileScroll className="n-scroll">
        <main className="n-main">
          <section className="n-hero">
            <img className="n-hero-art" src="/art/hero-v2.webp" alt="" />
            <div className="n-eyebrow">CREATOR JOURNEY / 01</div>
            <h1>
              从第一部漫剧
              <br />
              开启创作之旅<span>✦</span>
            </h1>
            <p>每次揭晓，都是一次新的创作机会。</p>
            <div className="n-reward">
              <span>新手阶段 · 平台奖励合计</span>
              <strong>
                <small>USD</small> 4.00
              </strong>
              <em>奖励规则可查看 · 任务内容逐次揭晓</em>
            </div>
            <div className="n-progress">
              <span>阶段进度</span>
              <b>{Math.round((completed / 6) * 100)}%</b>
            </div>
            <div
              className="n-meter"
              role="progressbar"
              aria-label="新手阶段完成进度"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round((completed / 6) * 100)}
              aria-valuetext={`${Math.round((completed / 6) * 100)}%`}
            >
              <i style={{ width: `${(completed / 6) * 100}%` }} />
            </div>
          </section>
          <section className="n-balance">
            <div>
              <span>可用奖励</span>
              <b>${balance.toFixed(2)}</b>
            </div>
            <div>
              <span>任务冻结</span>
              <b>${stage === 2 && review ? deposit.toFixed(2) : "0.00"}</b>
            </div>
            <button onClick={() => setSheet("ledger")}>
              资金明细 <ArrowRightIcon />
            </button>
          </section>
          <div className="n-section-title">
            <h2>本阶段任务</h2>
            <span>逐次揭晓</span>
          </div>
          <section className="n-route">
            {steps.map(([title, desc, reward], i) => (
              <div
                className={
                  "n-step " +
                  (i < currentIndex
                    ? "done"
                    : i === currentIndex
                      ? "active"
                      : "locked")
                }
                key={title}
              >
                <div className="n-node">
                  {i < currentIndex || stage === 6 ? (
                    <CheckIcon />
                  ) : i > currentIndex ? (
                    <LockClosedIcon />
                  ) : (
                    i + 1
                  )}
                </div>
                <div className="n-step-body">
                  <div className="n-step-title">
                    <b>
                      {i > currentIndex
                        ? `神秘任务 ${String(i + 1).padStart(2, "0")}`
                        : title}
                    </b>
                    <em>{i > currentIndex ? "未揭晓" : reward}</em>
                  </div>
                  <p>{i > currentIndex ? "内容暂未揭晓" : desc}</p>
                  {i === currentIndex && (
                    <div className="n-current" key={pulse}>
                      {stage === 1 ? (
                        <>
                          <p>
                            支持居民身份证、护照、驾驶证。上传正反面，提交后等待审核。
                          </p>
                          <span className="n-tag">
                            <PersonIcon /> 通过后奖励 $1.00
                          </span>
                        </>
                      ) : stage === 2 ? (
                        <>
                          <div className="n-drama">
                            <img
                              src="/art/revenge-v2.webp"
                              alt="漫剧任务封面"
                            />
                            <div>
                              <small>系统派发 · 新手专属</small>
                              <h3>重生之复仇女王</h3>
                              <p>发布 1 条漫剧推广视频</p>
                              <span>
                                预付 ${deposit.toFixed(2)} <i>从奖励余额冻结</i>
                              </span>
                            </div>
                          </div>
                          <p>
                            {review
                              ? "任务已提交，等待后台审核；通过后返还预付。"
                              : "无需充值。审核通过后，冻结的预付全额返还。任务佣金由后台另行配置。"}
                          </p>
                        </>
                      ) : stage === 3 ? (
                        <>
                          <div className="n-bybit">
                            <b>
                              BYBIT <small>GEORGIA</small>
                            </b>
                            <span>添加本人收款方式</span>
                          </div>
                          <p>
                            账户方式与 BTC
                            地址分别审核。实际收款金额、费用和最低限额，在提现前确认。
                          </p>
                        </>
                      ) : stage === 4 ? (
                        <>
                          <p>
                            可申请提现
                            $2.00。提交后冻结金额，后台审批后进入出款流程。
                          </p>
                          <span className="n-tag">
                            <CardStackIcon />{" "}
                            {method === "uid"
                              ? "Bybit Georgia · 本人账户"
                              : "Bitcoin · BTC 主网"}
                          </span>
                        </>
                      ) : stage === 5 ? (
                        <>
                          <div className="n-payout">
                            <ClockIcon />
                            <b>{paying ? "出款中" : "审核中"}</b>
                            <span>申请金额 $2.00</span>
                          </div>
                          <p>
                            {paying
                              ? "后台已审核通过，等待实际转账。只有确认已出款，才发放毕业奖励。"
                              : "已提交提款申请，请等待后台审核。此时尚未发放毕业奖励。"}
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="n-graduate">
                            <StarFilledIcon />
                            <h3>新手阶段已完成</h3>
                            <strong>+ $2.00</strong>
                            <p>
                              首次提现已确认出款，毕业奖励入账，可继续申请提现。
                            </p>
                          </div>
                        </>
                      )}
                      <button
                        className="n-primary"
                        onClick={() => setSheet("action")}
                      >
                        {titles[stage]} <ArrowRightIcon />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </section>
          <section className="n-info">
            <div className="n-section-title">
              <h2>认识 Bybit Georgia</h2>
              <span>独立第三方服务</span>
            </div>
            <p>
              可了解数字资产收款、账户安全设置与官方邀请活动。参加前请确认所在地是否适用，并阅读活动要求。
            </p>
            <a
              href="https://www.bybitgeorgia.ge/en-GEO/help-center/article/Bybit-Referral-Program-General-FAQ"
              target="_blank"
              rel="noreferrer"
            >
              查看官方邀请活动说明 <ArrowRightIcon />
            </a>
            <button disabled>推广邀请链接待配置</button>
            <small>
              平台的 $4 奖励由本平台提供；不等同于 Bybit
              官方奖励。官方活动可能包含交易条件及非现金权益。
            </small>
          </section>
          <section className="n-next">
            <LockClosedIcon />
            <div>
              <h3>进阶创作计划</h3>
              <p>
                系统随机派发 5–6
                笔任务，每次只揭晓当前任务。阶段中的任务内容保持神秘。
              </p>
              <small>后续阶段不影响已有可用余额申请提现。</small>
              <a className="n-preview-next" href="/?view=app&design=advanced">
                体验第二阶段 <ArrowRightIcon />
              </a>
            </div>
          </section>
          <details className="n-demo">
            <summary>体验设置</summary>
            <label>
              查看任意步骤
              <select
                aria-label="查看步骤"
                value={stage}
                onChange={(e) => {
                  setStage(Number(e.target.value));
                  setReview(false);
                  setPaying(false);
                }}
              >
                {steps.map((_, i) => (
                  <option key={i} value={i + 1}>
                    步骤 {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <label>
              预付订单金额
              <select
                aria-label="预付订单金额"
                value={deposit}
                onChange={(e) => setDeposit(Number(e.target.value))}
              >
                <option value={1.68}>$1.68</option>
                <option value={1.88}>$1.88</option>
              </select>
            </label>
            <p>进度会保存在当前账号；金额在本轮确定，刷新不重抽。</p>
            <div className="n-effect-tools">
              <button
                onClick={() => {
                  setPulse((v) => v + 1);
                  setEffect({ kind: "task", nonce: pulse + 1 });
                  audio.play("task");
                }}
              >
                预览任务揭晓
              </button>
              <button
                onClick={() => {
                  setPulse((v) => v + 1);
                  setEffect({
                    kind: "reward",
                    amount: "+ $2.00",
                    title: "奖励特效 · 示例",
                    subtitle: "只预览动画，不改变本轮记录。",
                    nonce: pulse + 1,
                  });
                  audio.play("reward");
                }}
              >
                预览奖励特效
              </button>
              <button
                onClick={() => {
                  setSession(freshSession());
                  setEffect(null);
                }}
              >
                重新体验新手阶段
              </button>
            </div>
          </details>
          <footer className="n-foot">
            <ReaderIcon /> 平台奖励有记录，审核进度可追踪
          </footer>
        </main>
      </MobileScroll>
      <BottomSheet
        open={!!sheet}
        onOpenChange={(v) => !v && setSheet("")}
        title={
          sheet === "rules"
            ? "新手阶段规则"
            : sheet === "ledger"
              ? "奖励与资金明细"
              : "新手阶段 · 交互预览"
        }
      >
        <div className="n-sheet">
          <button className="n-close" onClick={() => setSheet("")}>
            关闭
          </button>
          {sheet === "rules" ? (
            <>
              <p>
                平台固定奖励合计 4 USD：注册 1 USD，实名通过 1
                USD，首次提现已出款后 2 USD。
              </p>
              <p>
                新手只派发 1 笔任务，预付 1.68 / 1.88 USD
                从奖励余额冻结，审核通过返还。佣金待后台配置，不计入上述固定奖励。
              </p>
              <p>
                绑定收款方式本身不发奖励。提现拒绝后释放冻结；审批通过显示出款中，确认实际付款后显示已出款。
              </p>
            </>
          ) : sheet === "ledger" ? (
            <>
              <div className="n-ledger">
                注册奖励 <b>+ $1.00</b>
              </div>
              <div className="n-ledger">
                实名奖励 <b>{stage > 1 ? "+ $1.00" : "待审批"}</b>
              </div>
              <div className="n-ledger">
                任务预付{" "}
                <b>
                  {stage === 2 && review
                    ? "冻结 $" + deposit.toFixed(2)
                    : "无冻结"}
                </b>
              </div>
              <div className="n-ledger">
                首次出款{" "}
                <b>
                  {stage === 6
                    ? "已出款 $2.00"
                    : stage === 5
                      ? "冻结 $2.00"
                      : "未申请"}
                </b>
              </div>
              <div className="n-ledger">
                毕业奖励 <b>{stage === 6 ? "+ $2.00" : "待首次出款"}</b>
              </div>
              <p>
                设计示例未计任务佣金及渠道手续费；实际提现确认页必须先展示费用与净到账。
              </p>
            </>
          ) : (
            <>
              <h3>{steps[currentIndex][0]}</h3>
              {stage === 3 ? (
                <>
                  <label>
                    收款渠道
                    <select
                      aria-label="收款渠道"
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                    >
                      <option value="uid">Bybit Georgia 本人账户</option>
                      <option value="btc">Bitcoin · BTC 主网地址</option>
                    </select>
                  </label>
                  <p>
                    {method === "uid"
                      ? "正式版填写本人账户 UID，并提交后台审批；平台不会索取交易所密码、私钥或助记词。"
                      : "正式版校验 BTC 地址与网络，报价后确认最低金额、手续费和净到账。未配置通道时不可提交真实提现。"}
                  </p>
                </>
              ) : (
                <p>
                  {stage === 1
                    ? "正式版在实名表单提交证件资料，等待后台人工审批。"
                    : stage === 2
                      ? review
                        ? "后台审核任务通过，返还冻结预付。"
                        : "确认后从已有奖励冻结预付，不要求充值；完成发布后提交审核。"
                      : stage === 4
                        ? "提交首次提现申请，冻结 2 USD 并进入审核中。"
                        : stage === 5
                          ? paying
                            ? "后台核对真实出款凭证并标记已出款，随后仅发放一次 2 USD 毕业奖励。"
                            : "后台审批通过，状态由审核中进入出款中。"
                          : "毕业奖励已经到账。正式版可以从钱包独立申请提现。"}
                </p>
              )}
              <button
                className="n-primary"
                onClick={stage === 6 ? () => setSheet("ledger") : advance}
              >
                {stage === 1
                  ? "实名审批通过"
                  : stage === 2
                    ? review
                      ? "完成任务并继续"
                      : "完成任务并提交"
                    : stage === 3
                      ? "提款方式审批通过"
                      : stage === 4
                        ? "提交提现申请"
                        : stage === 5
                          ? paying
                            ? "确认已出款并发奖励"
                            : "提现审批通过"
                          : "查看奖励明细"}
              </button>
            </>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
