import { useEffect, useRef, useState } from "react";
import {
  CheckIcon,
  ChevronRightIcon,
  DownloadIcon,
  FileTextIcon,
  PlusIcon,
  ReloadIcon,
  VideoIcon,
  PlayIcon,
  PauseIcon,
} from "@radix-ui/react-icons";
import {
  KeyboardInput,
  KeyboardTextarea,
  Carousel,
  useKeyboard,
} from "../mobile";
import { demoDramas } from "./stageSimulation";
import "./creative-planner.css";

type Plan = {
  version: 1;
  id: string;
  title: string;
  drama: number;
  platform: string;
  hook: string;
  middle: string;
  ending: string;
  caption: string;
  checks: boolean[];
  updatedAt: string;
};
const checks = [
  "字幕清晰，人物姓名无错字",
  "音乐、画面与素材使用权限已确认",
  "竖屏 9:16，开头三秒交代冲突",
  "文案与视频内容一致，没有误导性承诺",
];
const templates = [
  {
    name: "悬念反转",
    hook: "她以为一切已经结束，直到那个人再次出现。",
    middle: "用两段关键画面交代人物关系，保留真正的转折。",
    ending: "故事的另一面，才刚刚开始。",
  },
  {
    name: "人物独白",
    hook: "如果可以重来一次，你会做出同样的选择吗？",
    middle: "从人物视角串联冲突，配合一句内心独白。",
    ending: "这一次，她决定亲手改写结局。",
  },
  {
    name: "高光预告",
    hook: "这一幕，让整个故事彻底改变。",
    middle: "选取三段不同节奏的高光，逐步强化情绪。",
    ending: "下一次相遇，会是怎样的答案？",
  },
];
const newPlan = (): Plan => ({
  version: 1,
  id: crypto.randomUUID(),
  title: "我的第一份分镜",
  drama: 0,
  platform: "TikTok",
  hook: "",
  middle: "",
  ending: "",
  caption: "",
  checks: checks.map(() => false),
  updatedAt: new Date().toISOString(),
});
function valid(v: unknown): v is Plan {
  if (!v || typeof v !== "object") return false;
  const p = v as Plan;
  return (
    p.version === 1 &&
    typeof p.id === "string" &&
    typeof p.updatedAt === "string" &&
    Number.isFinite(Date.parse(p.updatedAt)) &&
    typeof p.title === "string" &&
    p.title.length <= 80 &&
    Number.isInteger(p.drama) &&
    p.drama >= 0 &&
    p.drama < demoDramas.length &&
    ["TikTok", "YouTube", "Facebook"].includes(p.platform) &&
    ["hook", "middle", "ending", "caption"].every(
      (k) =>
        typeof p[k as keyof Plan] === "string" &&
        String(p[k as keyof Plan]).length <= 2000,
    ) &&
    Array.isArray(p.checks) &&
    p.checks.length === checks.length &&
    p.checks.every((c) => typeof c === "boolean")
  );
}
function load(key: string): Plan {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    if (valid(v)) return v;
  } catch {
    /* A local draft may be absent or storage unavailable. */
  }
  return newPlan();
}
export default function CreativePlanner({ userId }: { userId: string }) {
  const keyboard = useKeyboard();
  const key = "drama-creative-plan-v1-" + userId;
  const [plan, setPlan] = useState<Plan>(() => load(key)),
    [status, setStatus] = useState("尚未保存"),
    [tab, setTab] = useState<"write" | "preview">("write"),
    [confirmReset, setConfirmReset] = useState(false),
    [pendingTemplate, setPendingTemplate] = useState<number | null>(null),
    [pendingCaption, setPendingCaption] = useState(false);
  const [exporting, setExporting] = useState(false),
    [exportMessage, setExportMessage] = useState("");
  const [playing, setPlaying] = useState(false),
    [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;
  const latest = useRef(plan);
  latest.current = plan;
  useEffect(
    () => () => {
      try {
        localStorage.setItem(key, JSON.stringify(latest.current));
      } catch {
        /* The visible save state and manual export provide recovery. */
      }
    },
    [key],
  );
  useEffect(() => {
    setStatus("正在保存到此浏览器…");
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(plan));
        setStatus("已保存至此浏览器");
      } catch {
        setStatus("保存失败，请导出文稿以保留内容");
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [key, plan]);
  useEffect(() => {
    if (!playing) return;
    const started = performance.now() - elapsedRef.current * 1000;
    const timer = setInterval(() => {
      const next = Math.min(18, (performance.now() - started) / 1000);
      setElapsed(next);
      if (next === 18) setPlaying(false);
    }, 100);
    return () => clearInterval(timer);
  }, [playing]);
  useEffect(() => {
    if (tab === "write") setPlaying(false);
  }, [tab]);
  function applyTemplate(index: number) {
    const t = templates[index];
    update({ hook: t.hook, middle: t.middle, ending: t.ending });
    setPendingTemplate(null);
  }
  function buildCaption() {
    update({
      caption: `${plan.hook || "一个选择，改变整个故事。"}\n${plan.ending || "一起走进这个故事。"}\n#${demoDramas[plan.drama].genre} #漫剧 #剧情`,
    });
    setPendingCaption(false);
  }
  function update(patch: Partial<Plan>) {
    setPlan((old) => ({
      ...old,
      ...patch,
      updatedAt: new Date().toISOString(),
    }));
    setConfirmReset(false);
  }
  function exportPlan() {
    const body = [
      plan.title,
      `剧集：${demoDramas[plan.drama].title} | ${plan.platform}`,
      `保存时间：${new Date(plan.updatedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`,
      "",
      "00–03 秒 / 开场",
      plan.hook,
      "",
      "03–12 秒 / 冲突",
      plan.middle,
      "",
      "12–18 秒 / 悬念",
      plan.ending,
      "",
      "发布文案",
      plan.caption,
      "",
      "发布检查",
      ...checks.map((label, i) => `${plan.checks[i] ? "[x]" : "[ ]"} ${label}`),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([body], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "创作分镜.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function exportCover() {
    if (exporting) return;
    keyboard.hide();
    setExporting(true);
    setExportMessage("");
    try {
      const response = await fetch(demoDramas[plan.drama].cover);
      if (!response.ok) throw new Error("封面素材暂时无法读取，请稍后重试");
      const image = await createImageBitmap(await response.blob()),
        canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        image.close();
        throw new Error("浏览器不支持封面导出，请保留文稿后更换浏览器");
      }
      const scale = Math.max(1080 / image.width, 1920 / image.height),
        width = image.width * scale,
        height = image.height * scale;
      ctx.drawImage(
        image,
        (1080 - width) / 2,
        (1920 - height) / 2,
        width,
        height,
      );
      image.close();
      const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
      gradient.addColorStop(0, "rgba(27,12,38,.25)");
      gradient.addColorStop(0.35, "rgba(27,12,38,.05)");
      gradient.addColorStop(0.65, "rgba(27,12,38,.55)");
      gradient.addColorStop(1, "rgba(27,12,38,.94)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1080, 1920);
      ctx.strokeStyle = "rgba(236,206,255,.45)";
      ctx.lineWidth = 2;
      ctx.strokeRect(62, 62, 956, 1796);
      ctx.fillStyle = "#edd9f7";
      ctx.font = "24px Arial";
      ctx.textAlign = "left";
      ctx.fillText("STORIES WORTH SHARING", 100, 130);
      ctx.textAlign = "right";
      ctx.fillText(plan.platform, 980, 130);
      ctx.textAlign = "center";
      ctx.fillStyle = "#d9b6ed";
      ctx.font = '28px "Microsoft YaHei",sans-serif';
      ctx.fillText(demoDramas[plan.drama].title, 540, 1210);
      const wrap = (text: string, maxWidth: number, maxLines: number) => {
        const lines: string[] = [];
        let line = "";
        for (const char of Array.from(text)) {
          if (char === "\n" || ctx.measureText(line + char).width > maxWidth) {
            lines.push(line);
            line = char === "\n" ? "" : char;
            if (lines.length === maxLines) break;
          } else line += char;
        }
        if (lines.length < maxLines && line) lines.push(line);
        return lines;
      };
      ctx.font = '600 62px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "rgba(0,0,0,.35)";
      ctx.shadowBlur = 12;
      const lines = wrap(
        plan.hook || plan.title || "走进一个值得期待的故事",
        800,
        4,
      );
      lines.forEach((line, i) => ctx.fillText(line, 540, 1335 + i * 94));
      ctx.shadowBlur = 0;
      ctx.font = '27px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = "#e0c9eb";
      wrap(plan.ending || "故事的另一面，才刚刚开始。", 780, 2).forEach(
        (line, i) => ctx.fillText(line, 540, 1735 + i * 47),
      );
      ctx.fillStyle = "#bc9bce";
      ctx.font = "18px Arial";
      ctx.fillText("CREATED WITH DRAMA STUDIO", 540, 1820);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("图片生成失败，请重试"))),
          "image/png",
        ),
      );
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = "漫剧竖版封面.png";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportMessage("1080 × 1920 PNG 封面已生成");
    } catch (e) {
      setExportMessage((e as Error).message || "封面导出失败");
    } finally {
      setExporting(false);
    }
  }
  const progress = plan.checks.filter(Boolean).length;
  const scene = elapsed < 3 ? 0 : elapsed < 12 ? 1 : 2;
  const previewText =
    scene === 0 ? plan.hook : scene === 1 ? plan.middle : plan.ending;
  function togglePlayback() {
    keyboard.hide();
    if (elapsed >= 18) setElapsed(0);
    setPlaying((v) => !v);
  }
  return (
    <div className="c-planner">
      <section className="c-intro">
        <div>
          <span>CREATOR TOOLKIT</span>
          <h2>把灵感，变成下一条作品</h2>
          <p>写分镜、看字幕预览、检查发布细节。</p>
        </div>
        <div className="c-intro-icon">
          <VideoIcon />
        </div>
      </section>
      <div className="c-tabs">
        <button
          className={tab === "write" ? "active" : ""}
          onClick={() => {
            keyboard.hide();
            setTab("write");
          }}
        >
          创作分镜
        </button>
        <button
          className={tab === "preview" ? "active" : ""}
          onClick={() => {
            keyboard.hide();
            setTab("preview");
          }}
        >
          画面预览
        </button>
      </div>
      {tab === "write" ? (
        <>
          <section className="c-panel">
            <label className="c-label">
              文稿名称
              <KeyboardInput
                maxLength={80}
                value={plan.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="给这份创作起个名字"
              />
            </label>
            <div className="c-pair">
              <label className="c-label">
                选择剧集
                <select
                  value={plan.drama}
                  onChange={(e) => update({ drama: Number(e.target.value) })}
                >
                  {demoDramas.map((d, i) => (
                    <option value={i} key={d.title}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="c-label">
                发布平台
                <select
                  value={plan.platform}
                  onChange={(e) => update({ platform: e.target.value })}
                >
                  <option>TikTok</option>
                  <option>YouTube</option>
                  <option>Facebook</option>
                </select>
              </label>
            </div>
          </section>
          <div className="c-heading">
            <h3>从一个写作方向开始</h3>
            <small>选择后填入分镜 · 可继续编辑</small>
          </div>
          <Carousel
            ariaLabel="分镜写作方向"
            contentClassName="c-template-track"
          >
            {templates.map((t, i) => (
              <button
                className="c-template"
                key={t.name}
                onClick={() => {
                  if (plan.hook || plan.middle || plan.ending)
                    setPendingTemplate(i);
                  else applyTemplate(i);
                }}
              >
                <span>0{i + 1}</span>
                <b>{t.name}</b>
                <small>
                  {i === 0
                    ? "先抛出问题，保留答案"
                    : i === 1
                      ? "用人物情绪带入故事"
                      : "用节奏串联精彩瞬间"}
                </small>
                <ChevronRightIcon />
              </button>
            ))}
          </Carousel>
          {pendingTemplate !== null && (
            <div className="c-overwrite" role="status">
              <p>使用“{templates[pendingTemplate].name}”会替换当前三段分镜。</p>
              <button onClick={() => applyTemplate(pendingTemplate)}>
                确认替换
              </button>
              <button onClick={() => setPendingTemplate(null)}>
                保留当前内容
              </button>
            </div>
          )}
          <section className="c-script">
            {(
              [
                {
                  key: "hook",
                  time: "00–03s",
                  name: "开场 · 抓住注意",
                  placeholder: "用一句台词或一个冲突开场…",
                },
                {
                  key: "middle",
                  time: "03–12s",
                  name: "发展 · 建立冲突",
                  placeholder: "写下这一段的画面、字幕与节奏…",
                },
                {
                  key: "ending",
                  time: "12–18s",
                  name: "结尾 · 留下悬念",
                  placeholder: "把故事停在最值得期待的一刻…",
                },
              ] as const
            ).map((field, i) => (
              <label className="c-scene" key={field.key}>
                <div>
                  <span>0{i + 1}</span>
                  <b>{field.name}</b>
                  <small>{field.time}</small>
                </div>
                <KeyboardTextarea
                  maxLength={2000}
                  value={plan[field.key]}
                  placeholder={field.placeholder}
                  onChange={(e) => update({ [field.key]: e.target.value })}
                />
                <footer>{plan[field.key].length} 字</footer>
              </label>
            ))}
          </section>
          <section className="c-panel">
            <label className="c-label">
              发布文案
              <KeyboardTextarea
                maxLength={2000}
                value={plan.caption}
                onChange={(e) => update({ caption: e.target.value })}
                placeholder="写下配文与合适的话题标签…"
              />
            </label>
            <div className="c-caption-actions">
              <small>{plan.caption.length} 字</small>
              <button
                onClick={() => {
                  if (plan.caption) setPendingCaption(true);
                  else buildCaption();
                }}
              >
                根据分镜整理文案 <PlusIcon />
              </button>
            </div>
            {pendingCaption && (
              <div className="c-overwrite" role="status">
                <p>已有发布文案，是否替换？</p>
                <button onClick={buildCaption}>确认替换</button>
                <button onClick={() => setPendingCaption(false)}>
                  保留文案
                </button>
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="c-preview-panel">
          <div className={"c-phone-preview" + (playing ? " playing" : "")}>
            <img
              src={demoDramas[plan.drama].cover}
              alt={demoDramas[plan.drama].title}
            />
            <div className="c-preview-shade" />
            <div className="c-preview-top">
              <span>9:16 · 字幕排版预览</span>
              <small>{plan.platform}</small>
            </div>
            <div className="c-preview-caption" key={scene}>
              <small>{demoDramas[plan.drama].title}</small>
              <h3>
                {previewText ||
                  (scene === 0
                    ? "在分镜中写下你的开场字幕"
                    : scene === 1
                      ? "在分镜中写下人物冲突"
                      : "在分镜中留下结尾悬念")}
              </h3>
              <p>
                {scene === 0
                  ? "开场 · 抓住注意"
                  : scene === 1
                    ? "发展 · 建立冲突"
                    : "结尾 · 留下悬念"}
              </p>
            </div>
            <span className="c-safe-mark">分镜预演 · 非最终视频</span>
          </div>
          <div className="c-playback">
            <button
              onClick={togglePlayback}
              aria-label={playing ? "暂停分镜预演" : "播放分镜预演"}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <div>
              <progress
                aria-label="分镜预演播放进度"
                max={18}
                value={elapsed}
              />
              <span>{String(Math.floor(elapsed)).padStart(2, "0")}s / 18s</span>
            </div>
            <button
              aria-label="重新播放分镜"
              onClick={() => {
                setPlaying(false);
                setElapsed(0);
              }}
            >
              <ReloadIcon />
            </button>
          </div>
          <div className="c-scene-tabs">
            {["开场 0–3s", "发展 3–12s", "结尾 12–18s"].map((label, i) => (
              <button
                key={label}
                aria-pressed={scene === i}
                onClick={() => {
                  setPlaying(false);
                  setElapsed([0, 3, 12][i]);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="c-preview-help">
            可播放 18
            秒分镜预演，检查三段字幕的节奏。导出封面使用开场字幕，尺寸为 1080 ×
            1920；不会生成或发布成片。
          </p>
          <button
            className="s-button secondary c-export-cover"
            disabled={exporting}
            onClick={exportCover}
          >
            <DownloadIcon />
            {exporting ? "正在生成封面…" : "导出竖版封面 PNG"}
          </button>
          {exportMessage && (
            <p className="c-export-message" role="status">
              {exportMessage}
            </p>
          )}
          <button
            className="c-outline"
            onClick={() => {
              keyboard.hide();
              setTab("write");
            }}
          >
            继续编辑分镜 <FileTextIcon />
          </button>
        </section>
      )}
      <section className="c-checklist">
        <div className="c-heading">
          <h3>发布前，最后看一遍</h3>
          <b>
            {progress}/{checks.length}
          </b>
        </div>
        {checks.map((label, i) => (
          <button
            key={label}
            role="checkbox"
            aria-checked={plan.checks[i]}
            onClick={() =>
              update({ checks: plan.checks.map((v, n) => (n === i ? !v : v)) })
            }
          >
            <span>{plan.checks[i] ? <CheckIcon /> : null}</span>
            {label}
          </button>
        ))}
      </section>
      <div className="c-save-status" role="status">
        <i />
        {status}
        <small>仅本账号在此浏览器可见</small>
      </div>
      <div className="c-bottom-actions">
        <button className="s-button secondary" onClick={exportPlan}>
          <DownloadIcon />
          导出创作文稿
        </button>
        <button
          className="c-reset"
          onClick={() => {
            if (confirmReset) {
              setPlan(newPlan());
              setConfirmReset(false);
            } else setConfirmReset(true);
          }}
        >
          <ReloadIcon />
          {confirmReset ? "确认清空此文稿" : "新建文稿"}
        </button>
      </div>
      {confirmReset && (
        <p className="c-reset-note">新建会清空当前本地文稿，建议先导出保存。</p>
      )}
      <p className="c-footnote">
        此工具整理你的输入，不调用 AI
        或外部服务。文稿不随平台工作区备份，请使用导出保留。
      </p>
    </div>
  );
}
