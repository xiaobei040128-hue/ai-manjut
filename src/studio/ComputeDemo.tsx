import { useEffect, useRef, useState } from "react";
import {
  ChevronLeftIcon,
  LightningBoltIcon,
  ArrowRightIcon,
  CheckIcon,
  DownloadIcon,
  ReloadIcon,
  ReaderIcon,
  Cross2Icon,
} from "@radix-ui/react-icons";
import {
  MobileScroll,
  BottomSheet,
  Carousel,
  KeyboardTextarea,
  useKeyboard,
} from "../mobile";
import {
  computePacks,
  newCompute,
  validCompute,
  computeChange,
  type ComputeState,
} from "./computeCredits";
import { downloadBlob } from "./downloads";
import "./newcomer.css";
import "./compute-demo.css";
const styles = [
  {
    name: "月夜奇幻",
    art: "/art/wolf-v2.webp",
    prompt: "月光下的古堡，一位少女回头望向远处的身影，紫色雾气，电影感构图。",
  },
  {
    name: "都市心动",
    art: "/art/hero-v2.webp",
    prompt: "雨后的都市街角，男女主角意外重逢，霓虹倒影，细腻的情绪特写。",
  },
  {
    name: "逆袭高光",
    art: "/art/revenge-v2.webp",
    prompt: "女主角走入华丽大厅，神情坚定，背景人群回头，强烈的戏剧张力。",
  },
];
type Work = {
  style: number;
  prompt: string;
  kind: "poster" | "storyboard";
  id: string;
};
export default function ComputeDemo({ ownerId }: { ownerId: string }) {
  const key = "drama-creative-credits-demo-v1:" + ownerId;
  const [state, setState] = useState<ComputeState>(() => {
    try {
      const s = JSON.parse(localStorage.getItem(key) || "null");
      if (validCompute(s, ownerId)) return s;
    } catch {}
    return newCompute(ownerId);
  });
  const current = useRef(state);
  current.current = state;
  const [sheet, setSheet] = useState(""),
    [pack, setPack] = useState(1),
    [style, setStyle] = useState(0),
    [kind, setKind] = useState<"poster" | "storyboard">("poster"),
    [prompt, setPrompt] = useState(styles[0].prompt),
    [progress, setProgress] = useState(0),
    [job, setJob] = useState<Work | null>(null),
    [result, setResult] = useState<Work | null>(null),
    [fail, setFail] = useState(false),
    [message, setMessage] = useState(""),
    [storageError, setStorageError] = useState(false);
  const keyboard = useKeyboard(),
    cost = kind === "poster" ? 20 : 10;
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [state, key]);
  // Demo credits are only deducted after a successful preview; a failed/cancelled run leaves balance intact.
  useEffect(() => {
    if (!job) return;
    const start = Date.now();
    const timer = setInterval(() => {
      const percentage = Math.min(100, Math.floor((Date.now() - start) / 60));
      setProgress(percentage);
      if (percentage < 100) return;
      clearInterval(timer);
      if (fail) {
        setMessage("本次生成失败，预留额度已全部释放。");
      } else {
        const next = computeChange(
          current.current,
          job.id,
          "创作预览 · " + (job.kind === "poster" ? "漫剧海报" : "三段分镜"),
          -(job.kind === "poster" ? 20 : 10),
        );
        current.current = next;
        setState(next);
        setResult(job);
        setMessage("创作预览已完成");
      }
      setJob(null);
    }, 120);
    return () => clearInterval(timer);
  }, [job, fail]);
  function start() {
    keyboard.hide();
    setMessage("");
    if (!prompt.trim()) {
      setMessage("请先写下你的画面描述");
      return;
    }
    if (state.credits < cost) {
      setSheet("packs");
      return;
    }
    setProgress(0);
    setResult(null);
    setJob({ style, prompt: prompt.trim(), kind, id: crypto.randomUUID() });
  }
  function purchase() {
    const selected = computePacks[pack];
    setState((s) =>
      computeChange(
        s,
        crypto.randomUUID(),
        "套餐试用 · " + selected.name,
        selected.credits,
      ),
    );
    setSheet("");
    setMessage(`已添加 ${selected.credits} 点演示额度，未扣款`);
  }
  function exportScript() {
    if (!result) return;
    downloadBlob(
      new Blob(
        [
          `AI 创作工作室 · 分镜示例\n画面描述：${result.prompt}\n风格：${styles[result.style].name}\n\n0–3 秒｜环境建立：呈现故事发生的地点与光线。\n3–10 秒｜人物冲突：用主角视线和关键动作表现情绪变化。\n10–15 秒｜悬念收束：保留转折，以人物特写结束。\n\n此文件为规则模板生成的预览，不是 AI 模型生成的视频。`,
        ],
        { type: "text/plain;charset=utf-8" },
      ),
      "漫剧分镜示例.txt",
    );
  }
  return (
    <div
      className={
        "studio n-stage q-compute" +
        (new URLSearchParams(location.search).get("view") === "app" ||
        innerWidth <= 600
          ? " native-mode"
          : "")
      }
    >
      <header className="n-header">
        <a href="/?view=app" aria-label="返回应用">
          <ChevronLeftIcon />
        </a>
        <b>
          AI 创作工作室
          <small className="s-funds-notice">交互演示 · 不扣款</small>
        </b>
        <button onClick={() => setSheet("rules")}>说明</button>
      </header>
      <MobileScroll className="n-scroll">
        <main className="q-main">
          <section className="q-hero">
            <div className="q-orb" aria-hidden="true">
              <i />
              <i />
              <i />
              <LightningBoltIcon />
            </div>
            <span className="q-eyebrow">CHAPTER 03 / IMAGINATION ENGINE</span>
            <h1>
              把灵感
              <br />
              变成下一幕<span>✦</span>
            </h1>
            <p>为你的故事，注入新的创造力。</p>
            <div className="q-hero-foot">
              <span>独立创作服务</span>
              <span>自愿使用 · 随时开始</span>
            </div>
          </section>
          <section className="q-balance">
            <div>
              <span>可用创作额度</span>
              <strong>
                {state.credits - (job ? (job.kind === "poster" ? 20 : 10) : 0)}
                <small>点</small>
              </strong>
              {job && (
                <small>生成中预留 {job.kind === "poster" ? 20 : 10} 点</small>
              )}
            </div>
            <button onClick={() => setSheet("packs")} disabled={!!job}>
              获取额度
              <ArrowRightIcon />
            </button>
            <button
              className="q-ledger-trigger"
              aria-label="额度明细"
              onClick={() => setSheet("ledger")}
            >
              <ReaderIcon />
            </button>
          </section>
          {storageError && (
            <p className="q-warning" role="alert">
              浏览器无法保存演示记录，关闭后可能丢失。
            </p>
          )}
          <div className="q-heading">
            <h2>开始一次创作</h2>
            <span>MAKE SOMETHING NEW</span>
          </div>
          <div className="q-type-tabs">
            <button
              disabled={!!job}
              aria-pressed={kind === "poster"}
              onClick={() => setKind("poster")}
            >
              漫剧海报<small>20 点 / 次</small>
            </button>
            <button
              disabled={!!job}
              aria-pressed={kind === "storyboard"}
              onClick={() => setKind("storyboard")}
            >
              剧情分镜<small>10 点 / 次</small>
            </button>
          </div>
          <Carousel ariaLabel="创作风格" contentClassName="q-style-rail">
            {styles.map((s, i) => (
              <button
                key={s.name}
                disabled={!!job}
                aria-pressed={style === i}
                onClick={() => {
                  setStyle(i);
                  setPrompt(s.prompt);
                }}
              >
                <img src={s.art} alt="" />
                <span>{s.name}</span>
                {style === i && <CheckIcon />}
              </button>
            ))}
          </Carousel>
          <section className="q-composer">
            <label htmlFor="compute-prompt">
              描述你想看到的故事画面<span>{prompt.length}/500</span>
            </label>
            <KeyboardTextarea
              id="compute-prompt"
              disabled={!!job}
              maxLength={500}
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="人物、场景、情绪、光线……"
            />
            <div className="q-spec">
              <span>9:16 竖屏</span>
              <span>{kind === "poster" ? "海报示例" : "15 秒分镜模板"}</span>
              <span>单次 {cost} 点</span>
            </div>
            {job ? (
              <div className="q-generation" role="status" aria-live="polite">
                <div>
                  <span>
                    {progress < 30
                      ? "正在理解画面描述"
                      : progress < 70
                        ? "正在构建创作预览"
                        : "正在整理作品"}
                  </span>
                  <b>{progress}%</b>
                </div>
                <progress max={100} value={progress} />
                <button
                  onClick={() => {
                    setJob(null);
                    setMessage("已取消，预留额度已释放");
                  }}
                >
                  取消生成
                </button>
              </div>
            ) : (
              <button className="q-generate" onClick={start}>
                <LightningBoltIcon />
                生成创作预览<span>{cost} 点</span>
              </button>
            )}
            <small className="q-sample-note">
              演示使用已有海报和分镜模板，未连接 AI 生成模型。
            </small>
          </section>
          {message && (
            <p className="q-message" role="status">
              {message}
            </p>
          )}
          {result && (
            <section className="q-result">
              <div className="q-heading">
                <h2>你的创作预览</h2>
                <span>READY TO EXPLORE</span>
              </div>
              {result.kind === "poster" ? (
                <div className="q-result-art">
                  <img
                    src={styles[result.style].art}
                    alt={styles[result.style].name + "海报示例"}
                  />
                  <span>海报示例 · {styles[result.style].name}</span>
                </div>
              ) : (
                <div className="q-storyboard">
                  {["环境建立", "人物冲突", "悬念收束"].map((label, i) => (
                    <div key={label}>
                      <span>0{i + 1}</span>
                      <b>{label}</b>
                      <p>
                        {
                          [
                            "建立场景与光线，交代故事氛围。",
                            "围绕人物动作展开冲突，突出情绪变化。",
                            "保留转折，以特写留下悬念。",
                          ][i]
                        }
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <p>{result.prompt}</p>
              <button onClick={exportScript}>
                <DownloadIcon />
                导出分镜说明
              </button>
            </section>
          )}
          <section className="q-value">
            <h3>把额度，用在创作上</h3>
            <p>
              免费额度可直接体验。是否购买额度，不影响任务进度、已有奖励或提现。
            </p>
          </section>
          <details className="q-controls">
            <summary>演示设置</summary>
            <label>
              <input
                type="checkbox"
                checked={fail}
                disabled={!!job}
                onChange={(e) => setFail(e.target.checked)}
              />
              下一次演示生成失败
            </label>
            <button
              disabled={!!job}
              onClick={() => {
                setState(newCompute(ownerId));
                setResult(null);
                setMessage("已重置当前账号的创作演示额度");
              }}
            >
              <ReloadIcon />
              重置演示额度
            </button>
          </details>
        </main>
      </MobileScroll>
      <BottomSheet
        open={!!sheet}
        onOpenChange={(open) => !open && setSheet("")}
        title={
          sheet === "packs"
            ? "选择创作额度"
            : sheet === "ledger"
              ? "额度明细"
              : "使用说明"
        }
        description={
          sheet === "packs"
            ? "套餐价格为示例，本次不会付款。"
            : "AI 创作工作室 · 演示"
        }
      >
        <div className="q-sheet">
          <button
            className="q-close"
            aria-label="关闭面板"
            onClick={() => setSheet("")}
          >
            <Cross2Icon />
          </button>
          {sheet === "packs" ? (
            <>
              <p className="q-pack-intro">按需选择，无自动续费</p>
              <div className="q-packs">
                {computePacks.map((p, i) => (
                  <button
                    key={p.name}
                    aria-pressed={pack === i}
                    onClick={() => setPack(i)}
                  >
                    <span>
                      {p.name}
                      {i === 1 && <small>推荐</small>}
                    </span>
                    <strong>
                      {p.credits}
                      <small>点</small>
                    </strong>
                    <b>
                      ${p.price}
                      <small> USD</small>
                    </b>
                    <em>约 {Math.floor(p.credits / 20)} 次海报预览</em>
                  </button>
                ))}
              </div>
              <p>
                示例额度无有效期，不可提现或转让。生成失败不消耗额度；此处不产生订单或支付。
              </p>
              <button className="q-generate" onClick={purchase}>
                体验添加 {computePacks[pack].credits} 点<ArrowRightIcon />
              </button>
            </>
          ) : sheet === "ledger" ? (
            <>
              <p>仅当前账号、当前浏览器的创作演示记录。</p>
              {state.entries.map((e) => (
                <div className="q-entry" key={e.id}>
                  <div>
                    <b>{e.label}</b>
                    <small>{new Date(e.at).toLocaleString("zh-CN")}</small>
                  </div>
                  <strong>
                    {e.delta > 0 ? "+" : ""}
                    {e.delta} 点
                  </strong>
                </div>
              ))}
            </>
          ) : (
            <>
              <h3>独立、自愿的创作工具</h3>
              <p>
                本页演示额度套餐、预留、消耗、失败释放和作品预览。初始赠送 80
                点演示额度，按当前账号分开保存在此浏览器。
              </p>
              <p>
                没有调用真实 AI 模型，不售卖 GPU
                时长，不承诺收益，不办理真实充值。未来正式接入前需明确模型、交付规格、价格与退款条款。
              </p>
              <p>任务奖励、可提现余额与创作额度相互独立。</p>
            </>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
