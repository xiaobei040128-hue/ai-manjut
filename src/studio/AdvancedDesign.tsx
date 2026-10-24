import { useAccountJourney } from "./AccountJourney";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  Cross2Icon,
  DownloadIcon,
  LockClosedIcon,
  ReaderIcon,
  ReloadIcon,
  SpeakerLoudIcon,
  SpeakerOffIcon,
  StarFilledIcon,
} from "@radix-ui/react-icons";
import { BottomSheet, MobileScroll } from "../mobile";
import JourneyEffects, {
  useJourneyAudio,
  type JourneyEvent,
} from "./JourneyEffects";
import {
  amountRanges,
  createSimulation,
  demoDramas,
  simulatedMoney,
  transitionSimulation,
  validateSimulation,
  type Simulation,
} from "./stageSimulation";
import "./newcomer.css";
import "./advanced-design.css";

export default function AdvancedDesign() {
  const { advanced: simulation, setAdvanced: setSimulation } =
    useAccountJourney();
  const [sheet, setSheet] = useState(""),
    [notice, setNotice] = useState(""),
    [artError, setArtError] = useState(false),
    [medalReady, setMedalReady] = useState(false),
    [event, setEvent] = useState<JourneyEvent | null>(null);
  const [reviewMode, setReviewMode] = useState<
    "stage" | "selective" | "automatic"
  >("stage");
  const sequence = useRef(0),
    missionRef = useRef<HTMLDivElement | null>(null),
    audio = useJourneyAudio();
  const closeEffect = useCallback(() => {
    setEvent(null);
    missionRef.current?.scrollIntoView({
      block: "start",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, []);
  const current = simulation.orders[simulation.completed],
    drama = current ? demoDramas[current.drama] : null,
    complete = simulation.status === "settled",
    stageReview = simulation.status === "stage_review";
  const earned = simulation.orders
    .slice(0, simulation.completed)
    .reduce((sum, o) => sum + o.commission, 0);
  const settledAmount = simulation.orders
    .slice(0, simulation.completed)
    .reduce((sum, o) => sum + o.amount, 0);
  function announce(
    kind: JourneyEvent["kind"],
    amount?: string,
    title?: string,
    subtitle?: string,
  ) {
    sequence.current++;
    setEvent({ kind, amount, title, subtitle, nonce: sequence.current });
    audio.play(kind);
  }
  function action(type: "reveal" | "start" | "submit" | "approve" | "revise") {
    const next = transitionSimulation(simulation, type);
    if (next === simulation) return;
    setSimulation(next);
    setSheet("");
    if (type === "reveal")
      announce(
        "task",
        undefined,
        "这一单，正式揭晓",
        `第 ${current.sequence} 笔 · ${drama?.title}`,
      );
    if (
      type === "approve" ||
      (type === "submit" && next.completed > simulation.completed)
    ) {
      const finished = next.status === "settled";
      const total = next.orders
        .slice(0, next.completed)
        .reduce((sum, order) => sum + order.commission, 0);
      announce(
        finished ? "complete" : "reward",
        finished
          ? simulatedMoney(total)
          : "+ " + simulatedMoney(current?.commission || 0),
        finished ? "进阶阶段已完成" : "任务已完成 · 奖励待结算",
        finished
          ? `本阶段奖励 ${simulatedMoney(total)} 已结算。`
          : "任务进度已更新，奖励将在阶段审核通过后结算。",
      );
    }
  }
  function restart(count?: 5 | 6) {
    setSimulation({
      ...createSimulation(count),
      reviewMode: reviewMode,
      reviewOrders: reviewMode === "selective" ? [2] : [],
    });
    setSheet("");
    setEvent(null);
  }
  function exportSimulation() {
    const body = JSON.stringify(
        {
          type: "DESIGN_SIMULATION_ONLY",
          ...simulation,
          simulatedEarned: earned,
        },
        null,
        2,
      ),
      url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "stage-two-simulation.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div
      className={
        "studio n-stage a-stage" +
        (new URLSearchParams(location.search).get("view") === "app" ||
        window.innerWidth <= 600
          ? " native-mode"
          : "")
      }
    >
      <header className="n-header">
        <a href="/?view=app" aria-label="返回应用">
          <ChevronLeftIcon />
        </a>
        <b>
          创作者进阶<small className="s-funds-notice">预览版</small>
        </b>
        <div className="n-header-tools">
          <button
            className="a-sound"
            aria-label={audio.enabled ? "关闭音效" : "开启音效"}
            aria-pressed={audio.enabled}
            onClick={audio.toggle}
          >
            {audio.enabled ? <SpeakerLoudIcon /> : <SpeakerOffIcon />}
          </button>
          <button onClick={() => setSheet("rules")}>规则</button>
        </div>
      </header>
      <MobileScroll className="n-scroll" key={simulation.id}>
        <main className="a-main">
          <section className="a-hero">
            <img src="/art/wolf-v2.webp" alt="奇幻漫剧人物" />
            <div className="a-hero-shade" />
            <div className="a-hero-copy">
              <span className="a-eyebrow">CHAPTER 02 / THE NEXT STORY</span>
              <h1>
                每一次揭晓
                <br />
                都有新的可能
              </h1>
              <p>故事未完，属于你的进阶篇章已开启。</p>
              <span className="a-stage-pill">
                <StarFilledIcon /> 进阶创作计划
              </span>
            </div>
            <div className="a-progress-box">
              <div>
                <span>本阶段已完成</span>
                <b>
                  {Math.round(
                    (simulation.completed / simulation.orders.length) * 100,
                  )}
                  <small>%</small>
                </b>
              </div>
              <div
                className="a-progress"
                role="progressbar"
                aria-label="进阶阶段完成进度"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(
                  (simulation.completed / simulation.orders.length) * 100,
                )}
                aria-valuetext={`${Math.round((simulation.completed / simulation.orders.length) * 100)}%`}
              >
                <i
                  style={{
                    width: `${(simulation.completed / simulation.orders.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          </section>
          <section className="a-stats">
            <div>
              <span>{complete ? "已结算佣金" : "待结算奖励"}</span>
              <strong>{simulatedMoney(earned)}</strong>
            </div>
            <div>
              <span>已完成单额</span>
              <strong>{simulatedMoney(settledAmount)}</strong>
            </div>
            <button
              aria-label="查看结算记录"
              onClick={() => setSheet("history")}
            >
              <ReaderIcon />
            </button>
          </section>
          <div className="a-section-heading" ref={missionRef}>
            <div>
              <small>YOUR CURRENT MISSION</small>
              <h2>{complete ? "这一章的收获" : "当前任务"}</h2>
            </div>
            <span>
              {complete
                ? "已完成"
                : stageReview
                  ? "阶段审核中"
                  : simulation.status === "review"
                    ? "审核中"
                    : simulation.status === "working"
                      ? "体验进行中"
                      : simulation.revealed
                        ? "已派发"
                        : "等待揭晓"}
            </span>
          </div>
          {stageReview ? (
            <section className="a-finale">
              <ClockIcon />
              <h2>本阶段已提交审核</h2>
              <p>全部任务已完成，无需逐笔等待。审核通过后统一结算。</p>
              <strong>{simulatedMoney(earned)}</strong>
              <span>待结算奖励</span>
              <button className="a-primary" onClick={() => setSheet("review")}>
                查看阶段审核
              </button>
              <button
                className="a-secondary"
                onClick={() => setSheet("history")}
              >
                查看任务记录
              </button>
            </section>
          ) : complete ? (
            <section className="a-finale">
              <div
                className={"a-finale-medal" + (medalReady ? " art-ready" : "")}
              >
                <CheckIcon />
                <img
                  src="/art/reward-medal-v1.png"
                  alt="进阶成就勋章"
                  onLoad={() => setMedalReady(true)}
                />
              </div>
              <small>CHAPTER COMPLETE</small>
              <h2>
                每一份创作
                <br />
                都值得被看见
              </h2>
              <p>本阶段 {simulation.orders.length} 笔任务已完成。</p>
              <strong>{simulatedMoney(earned)}</strong>
              <span>{complete ? "已结算佣金" : "待结算奖励"}</span>
              <button className="a-primary" onClick={() => setSheet("history")}>
                查看阶段回顾 <ArrowRightIcon />
              </button>
              <button
                className="a-secondary"
                onClick={() => setSheet("restart")}
              >
                重新体验一轮
              </button>
            </section>
          ) : !simulation.revealed ? (
            <section className="a-mystery-card">
              <div className="a-mystery-orbit" aria-hidden="true">
                <i />
                {artError ? (
                  <div className="a-mystery-ticket">
                    <span>STUDIO</span>
                    <LockClosedIcon />
                    <small>0{current.sequence}</small>
                  </div>
                ) : (
                  <img
                    className="a-envelope-art"
                    src="/art/task-invitation-v1.png"
                    alt="神秘任务邀请函"
                    onError={() => setArtError(true)}
                  />
                )}
                <i />
              </div>
              <span className="a-kicker">MISSION 0{current.sequence}</span>
              <h2>一份未拆封的创作邀请</h2>
              <p>
                内容、单额与佣金率
                <br />
                将在揭晓时一同呈现。
              </p>
              <button className="a-primary" onClick={() => action("reveal")}>
                揭晓当前任务 <ArrowRightIcon />
              </button>
            </section>
          ) : (
            <section className="a-task-card" key={current.id}>
              <div className="a-task-art">
                <img src={drama!.cover} alt={drama!.title} />
                <div />
                <span>MISSION 0{current.sequence}</span>
                <span className="a-task-platform">{drama!.platform}</span>
                <h2>{drama!.title}</h2>
                <p>{drama!.genre} · 竖屏短视频</p>
              </div>
              <div className="a-task-content">
                <div className="a-amount-grid">
                  <div>
                    <span>订单金额</span>
                    <b>{simulatedMoney(current.amount)}</b>
                  </div>
                  <div>
                    <span>本笔佣金率</span>
                    <b>
                      {(current.rate / 100).toFixed(2)}
                      <small>%</small>
                    </b>
                  </div>
                </div>
                <div className="a-commission">
                  <span>
                    <StarFilledIcon /> 完成后佣金
                  </span>
                  <b>+ {simulatedMoney(current?.commission || 0)}</b>
                </div>
                <div className="a-brief">
                  <h3>创作内容</h3>
                  <p>{drama!.brief}</p>
                  <div>
                    <span>01</span>
                    <p>选取授权片段，保留故事人物与情节。</p>
                  </div>
                  <div>
                    <span>02</span>
                    <p>制作一条字幕清晰、比例为 9:16 的短视频。</p>
                  </div>
                  <div>
                    <span>03</span>
                    <p>普通任务提交后继续下一笔，阶段结束统一审核结算。</p>
                  </div>
                </div>
                {simulation.status === "review" ? (
                  <div className="a-review-state">
                    <ClockIcon />
                    <div>
                      <b>审核中</b>
                      <p>此笔为指定审核任务，通过后继续下一笔。</p>
                    </div>
                  </div>
                ) : null}
                <button
                  className="a-primary"
                  onClick={() =>
                    simulation.status === "ready"
                      ? action("start")
                      : setSheet(
                          simulation.status === "working" ? "submit" : "review",
                        )
                  }
                >
                  {simulation.status === "ready"
                    ? "开始任务"
                    : simulation.status === "working"
                      ? "提交作品"
                      : "查看审核"}{" "}
                  <ArrowRightIcon />
                </button>
              </div>
            </section>
          )}
          <section className="a-track-section">
            <div className="a-section-heading">
              <h2>本章轨迹</h2>
              <span>{simulation.orders.length} 笔任务</span>
            </div>
            <div className="a-track">
              {simulation.orders.map((o, i) => (
                <div
                  key={o.id}
                  className={
                    i < simulation.completed
                      ? "done"
                      : i === simulation.completed
                        ? "current"
                        : "locked"
                  }
                  aria-label={`任务 ${i + 1}：${i < simulation.completed ? "已完成" : i === simulation.completed ? "当前任务" : "未揭晓"}`}
                >
                  <span>
                    {i < simulation.completed ? (
                      <CheckIcon />
                    ) : i === simulation.completed ? (
                      <ReaderIcon />
                    ) : (
                      <LockClosedIcon />
                    )}
                  </span>
                  <small>{String(i + 1).padStart(2, "0")}</small>
                </div>
              ))}
            </div>
          </section>
          <section className="a-review-link">
            <div>
              <ReaderIcon />
              <span>
                <b>你的创作档案</b>
                <small>{notice}</small>
              </span>
            </div>
            <button
              aria-label="打开创作档案"
              onClick={() => setSheet("history")}
            >
              <ChevronRightIcon />
            </button>
          </section>
          <details className="a-demo-tools">
            <summary>体验设置</summary>
            <div>
              <button onClick={() => setSheet("restart")}>
                <ReloadIcon />
                重开
              </button>
              <button onClick={exportSimulation}>
                <DownloadIcon />
                导出记录
              </button>
              <button
                onClick={() =>
                  announce(
                    "task",
                    undefined,
                    "任务揭晓 · 特效预览",
                    "仅预览动画，不改变任务进度。",
                  )
                }
              >
                任务特效
              </button>
              <button
                onClick={() =>
                  announce(
                    "reward",
                    "+ $1.23",
                    "奖励特效 · 示例",
                    "特效预览，不计入结算记录。",
                  )
                }
              >
                奖励特效
              </button>
              <a href="/?view=app&design=newcomer">
                新手阶段 <ChevronRightIcon />
              </a>
            </div>
          </details>
          <footer className="a-footer">STORIES. CREATE. DISCOVER.</footer>
        </main>
      </MobileScroll>
      <BottomSheet
        open={!!sheet}
        onOpenChange={(v) => !v && setSheet("")}
        title={
          sheet === "rules"
            ? "第二阶段规则"
            : sheet === "history"
              ? "本章创作档案"
              : sheet === "restart"
                ? "重新体验"
                : sheet === "submit"
                  ? "提交作品"
                  : "审核进度"
        }
      >
        <div className="a-sheet">
          <button
            className="a-sheet-close"
            onClick={() => setSheet("")}
            aria-label="关闭面板"
          >
            <Cross2Icon />
          </button>
          {sheet === "rules" ? (
            <>
              <h3>每轮 5–6 笔，逐笔揭晓</h3>
              <p>
                5 笔时使用前五档，6 笔时增加第六档。金额随机到美分；佣金率
                3.00%–6.00%，精确到 0.01 个百分点。
              </p>
              <table>
                <thead>
                  <tr>
                    <th>顺序</th>
                    <th>金额范围</th>
                  </tr>
                </thead>
                <tbody>
                  {amountRanges.map(([low, high], i) => (
                    <tr key={i}>
                      <td>第 {i + 1} 笔</td>
                      <td>
                        {simulatedMoney(low)}–{simulatedMoney(high)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                佣金按单额 ×
                佣金率四舍五入到美分。普通任务提交后即时推进，指定任务单独审核。阶段审核通过前奖励待结算。审核方式在新一轮创建时确定。
              </p>
            </>
          ) : sheet === "history" ? (
            <>
              <div className="a-sheet-summary">
                <span>{complete ? "已结算佣金" : "待结算奖励"}</span>
                <strong>{simulatedMoney(earned)}</strong>
                <small>
                  {simulation.completed} / {simulation.orders.length} 笔已完成
                </small>
              </div>
              {simulation.completed === 0 ? (
                <div className="a-history-empty">
                  <ReaderIcon />
                  <h3>还没有完成记录</h3>
                  <p>完成第一笔任务后，金额和佣金会保存在这里。</p>
                </div>
              ) : (
                simulation.orders.slice(0, simulation.completed).map((o) => (
                  <div className="a-history-row" key={o.id}>
                    <img src={demoDramas[o.drama].cover} alt="" />
                    <div>
                      <b>{demoDramas[o.drama].title}</b>
                      <p>
                        第 {o.sequence} 笔 · {simulatedMoney(o.amount)} ·{" "}
                        {(o.rate / 100).toFixed(2)}%
                      </p>
                    </div>
                    <strong>+{simulatedMoney(o.commission)}</strong>
                  </div>
                ))
              )}
            </>
          ) : sheet === "restart" ? (
            <>
              <h3>选择本轮任务数量</h3>
              <label>
                审核方式
                <select
                  aria-label="审核方式"
                  value={reviewMode}
                  onChange={(e) =>
                    setReviewMode(e.target.value as typeof reviewMode)
                  }
                >
                  <option value="stage">阶段集中审核（推荐）</option>
                  <option value="selective">指定第 2 笔审核 + 阶段审核</option>
                  <option value="automatic">自动校验完成</option>
                </select>
              </label>
              <p>
                默认随机分配 5 或 6
                笔。也可以指定数量，方便检查两种布局。重开后当前记录会被替换。
              </p>
              <button className="a-primary" onClick={() => restart()}>
                随机 5–6 笔
              </button>
              <div className="a-restart-options">
                <button onClick={() => restart(5)}>体验 5 笔</button>
                <button onClick={() => restart(6)}>体验 6 笔</button>
              </div>
            </>
          ) : sheet === "submit" ? (
            <>
              <h3>提交作品</h3>
              <p>预览样例已准备；此处演示提交后的阶段流转。</p>
              <div className="a-evidence-placeholder">
                <CheckIcon />
                <span>示例作品记录已准备</span>
                <small>9:16 / 短视频</small>
              </div>
              <button className="a-primary" onClick={() => action("submit")}>
                提交并继续 <ArrowRightIcon />
              </button>
            </>
          ) : (
            <>
              <div className="a-review-timeline">
                <span className="done">
                  <CheckIcon />
                </span>
                <div>
                  <b>已提交记录</b>
                  <p>当前记录已保存至账号。</p>
                </div>
                <span className="active">
                  <ClockIcon />
                </span>
                <div>
                  <b>{stageReview ? "阶段集中审核" : "指定任务审核"}</b>
                  <p>还未结算，进度保持不变。</p>
                </div>
                <span>
                  <StarFilledIcon />
                </span>
                <div>
                  <b>通过后结算佣金</b>
                  <p>展示奖励动画并更新本章记录。</p>
                </div>
              </div>
              <button className="a-primary" onClick={() => action("approve")}>
                预览：审核通过
              </button>
              <button className="a-secondary" onClick={() => action("revise")}>
                预览：退回最后一笔修改
              </button>
            </>
          )}
        </div>
      </BottomSheet>
      <JourneyEffects event={event} onClose={closeEffect} />
    </div>
  );
}
