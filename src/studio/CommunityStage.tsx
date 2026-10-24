import EnrollmentCard from "./EnrollmentCard";
import { useCallback, useRef, useState } from "react";
import { MobileScroll, KeyboardInput, KeyboardTextarea, useKeyboard } from "../mobile";
import { useAccountJourney } from "./AccountJourney";
import "./community-stage.css";
import { createExampleQuote } from "./stageSimulation";
import { simulatedMoney } from "./stageSimulation";
import type { Simulation } from "./stageSimulation";
import JourneyEffects, { useJourneyAudio, type JourneyEvent } from "./JourneyEffects";
import { downloadBlob } from "./downloads";
const titles = ["认识 AI 漫剧", "发现你的故事偏好", "留下你的真实评价", "分享你喜欢的内容", "体验授权凭证"];
const empty = { completed: 0, genre: "", rating: 0, review: "", shared: false, code: "" };
function newCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), n => chars[n % chars.length]).join("");
}
export default function CommunityStage() {
  const { advanced, setAdvanced } = useAccountJourney();
  const [replay, setReplay] = useState<NonNullable<Simulation["community"]> | null>(null);
  const c: NonNullable<Simulation["community"]> = replay ?? advanced.community ?? empty;
  const keyboard = useKeyboard();
  const [answer, setAnswer] = useState(-1), [message, setMessage] = useState(""), [typed, setTyped] = useState("");
  const [reading, setReading] = useState(false), [sharing, setSharing] = useState(false);
  const done = c.completed === 5;
  const [revealed, setRevealed] = useState(-1);
  const [effect, setEffect] = useState<JourneyEvent | null>(null);
  const sequence = useRef(0), submitting = useRef(false);
  const audio = useJourneyAudio();
  const closeEffect = useCallback(() => {
    setEffect(null); submitting.current = false;
    requestAnimationFrame(() => {
      const card = document.querySelector<HTMLElement>(".community-card");
      card?.scrollIntoView({block:"start",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
      card?.querySelector<HTMLElement>(".community-primary,h2")?.focus({preventScroll:true});
    });
  }, []);
  function announce(kind: JourneyEvent["kind"], title: string, subtitle: string) {
    keyboard.hide();
    setEffect({ kind, title, subtitle, nonce: ++sequence.current });
    audio.play(kind);
  }
  function reveal() {
    setRevealed(c.completed);
    announce("task", titles[c.completed], `第 ${c.completed + 1} 项探索已揭晓`);
  }
  function startReplay() {
    keyboard.hide(); setReplay({...empty}); setRevealed(-1); setEffect(null);
    setMessage(""); setAnswer(-1); setTyped(""); setReading(false); submitting.current=false;
  }
  function endReplay() {
    keyboard.hide(); setReplay(null); setRevealed(-1); setEffect(null); setMessage(""); submitting.current=false;
  }
  function receipt() {
    const q = c.exampleQuote;
    const content = ["AI 漫剧 · 第二阶段体验记录", "不计入真实资金", "",
      ...titles.map((title, i) => `${i + 1}. ${title}：${i < c.completed ? "已完成" : "未完成"}`),
      `偏好：${c.genre || "未选择"}`, `评分：${c.rating}/5`, `评价：${c.review}`,
      `分享：${c.shared ? "用户自行确认" : "未分享"}`, `内部演示码：${c.code || "未生成"}`,
      ...(q ? [`计算示例：${simulatedMoney(q.amount)} × ${(q.rate/100).toFixed(2)}% = ${simulatedMoney(q.commission)}`] : []),
      "", "本记录不代表版权许可、付款凭证或钱包入账。"].join("\n");
    downloadBlob(new Blob([content], {type:"text/plain;charset=utf-8"}), "AI漫剧-阶段体验记录.txt");
  }
  function save(change: Partial<NonNullable<Simulation["community"]>>) {
    if (replay) { setReplay(old => ({ ...(old ?? empty), ...change })); return; }
    setAdvanced(old => ({ ...old, community: { ...(old.community ?? empty), ...change } }));
  }
  function advance(change: Partial<typeof empty> = {}) {
    if (submitting.current || done) return;
    submitting.current = true;
    const completed = Math.min(5, c.completed + 1);
    keyboard.hide(); setMessage(""); save({ ...change, completed });
    announce(completed === 5 ? "complete" : "reward", completed === 5 ? "本阶段探索完成" : "任务已完成", completed === 5 ? "五项探索已记录，可查看阶段回顾" : `探索进度提升至 ${completed * 20}%`);
  }
  async function share() {
    const text = "我正在探索 AI 漫剧：喜欢的故事，也可以有新的表达方式。";
    setSharing(true);
    try {
      if (navigator.share) await navigator.share({ title: "发现 AI 漫剧", text });
      else { await navigator.clipboard.writeText(text); setMessage("文案已复制，可自行选择社交平台分享。"); }
      // Sharing a sheet or copying text is not proof of publication.
    } catch { setMessage("未分享也可以继续，本项完全自愿。"); }
    finally { setSharing(false); }
  }
  return <div className={"studio community-stage native-mode" + (done ? " is-finished" : "")}>
    <header className="community-header"><a href="/?view=app" onClick={() => keyboard.hide()}>‹ 返回</a><b>第二阶段</b><span>不计入真实资金</span></header>
    <MobileScroll className="community-scroll"><div className="community-content">
      {replay ? <div className="community-replay"><span>独立试用 · 不保存到账号</span><button onClick={endReplay}>返回账号进度</button></div> : <div className="community-replay"><span>想重新体验这一章？</span><button onClick={startReplay}>从头试用</button></div>}
      <section className="community-hero"><span>CHAPTER 02 · EXPLORE</span><h1>让好故事<br/>被更多人看见。</h1><p>AI 漫剧探索计划</p><div className="community-percent"><span>探索进度</span><strong>{c.completed * 20}%</strong></div><progress max={100} value={c.completed * 20}/></section>
      <div className="community-toolbar"><span>系统派发 · 逐项揭晓</span><button onClick={audio.toggle} aria-label={audio.enabled ? "关闭音效" : "开启音效"}>{audio.enabled ? "♫ 音效已开" : "♪ 音效已关"}</button></div>
      {done && !replay && <EnrollmentCard/>}
      <section className="community-card" key={c.completed}>
        <small>{done ? "CHAPTER COMPLETE" : `MISSION 0${c.completed + 1}`}</small>
        <h2 tabIndex={-1}>{done ? "探索完成，感谢你的参与" : revealed === c.completed ? titles[c.completed] : "一份新的探索，等待你开启"}</h2>
        {!done && revealed !== c.completed && <div className="community-invitation"><div className="community-orbit" aria-hidden="true"/><img src="/art/task-invitation-v1.png" alt="密封的任务邀请函"/><p>打开邀请，查看当前任务。</p><button className="community-primary" onClick={reveal}>揭晓当前任务</button></div>}
        {(done || revealed === c.completed) && <>
        {c.completed === 0 && <><p>AI 漫剧通常结合 AI 辅助绘画、剧本、配音和剪辑。发布前仍需确认素材授权，并由创作者检查内容质量。</p><h3>使用 AI 辅助创作后，是否还需要确认素材授权？</h3>{["需要，AI 生成不等于自动获得全部权利", "不需要，所有 AI 素材都能自由商用"].map((s,i)=><button className="community-choice" aria-pressed={answer===i} key={s} onClick={()=>setAnswer(i)}>{s}</button>)}<button className="community-primary" disabled={answer<0} onClick={()=>answer===0 ? advance() : setMessage("再想一想：生成方式不能替代授权确认。")}>提交答案</button></>}
        {c.completed === 1 && <><img className="community-poster" src="/art/wolf-v2.webp" alt="狼人王子的契约新娘示例封面"/><h3>狼人王子的契约新娘</h3><p>月夜下，一纸契约将两人的命运连在一起。她想寻找真相，他却藏着无法说出的秘密。</p><button className="community-choice" onClick={()=>setReading(!reading)}>{reading ? "收起故事节选" : "阅读故事节选"}</button>{reading&&<blockquote>钟声响起，她推开古堡的大门。桌上只留着一封信：“如果你决定留下，请在黎明前找到我。”走廊尽头，熟悉的身影消失在月光里。</blockquote>}<h3>你最喜欢哪种题材？</h3><div className="community-genres">{["奇幻爱情","都市情感","重生逆袭","青春校园","末日冒险"].map(g=><button className="community-choice" aria-pressed={c.genre===g} key={g} onClick={()=>save({genre:g})}>{g}</button>)}</div><button className="community-primary" disabled={!reading||!c.genre} onClick={()=>advance()}>保存偏好并完成</button></>}
        {c.completed === 2 && <><p>喜欢与不喜欢，都值得被听见。</p><div className="community-stars" aria-label="评分">{[1,2,3,4,5].map(n=><button key={n} aria-label={`${n} 星`} aria-pressed={c.rating===n} onClick={()=>save({rating:n})}>{n<=c.rating?"★":"☆"}</button>)}</div><KeyboardTextarea value={c.review} maxLength={500} placeholder="聊聊剧情、画面或配音，至少 5 个字" onChange={e=>save({review:e.target.value})}/><button className="community-primary" disabled={!c.rating||c.review.trim().length<5} onClick={()=>advance()}>提交评价</button></>}
        {c.completed === 3 && <><p>将喜欢的内容带给朋友。是否分享由你决定，不影响后续流程。</p><blockquote>我正在探索 AI 漫剧：喜欢的故事，也可以有新的表达方式。</blockquote><button className="community-primary" disabled={sharing} onClick={()=>void share()}>选择分享方式 / 复制文案</button><button className="community-choice" onClick={()=>advance({shared:true})}>我已自行分享，继续</button><button className="community-text" onClick={()=>advance({shared:false})}>暂不分享，继续</button></>}
        {c.completed === 4 && <><p>了解一份授权凭证应该包含什么。</p><dl><dt>作品</dt><dd>AI 漫剧示例素材</dd><dt>本次范围</dt><dd>仅用于当前原型流程体验</dd><dt>商用授权</dt><dd>未提供，需另行取得权利人许可</dd></dl><p>下方为平台内部演示码，不是版权登记证明；本步骤不购买、不扣款。</p>{!c.code ? <button className="community-primary" onClick={()=>save({code:newCode()})}>生成 8 位演示码</button> : <><div className="community-code" aria-label="当前演示码">{c.code}</div><button className="community-choice" onClick={()=>void navigator.clipboard.writeText(c.code).then(()=>setMessage("已复制演示码")).catch(()=>setMessage("复制失败，请手动复制上方代码"))}>复制演示码</button><KeyboardInput aria-label="填写演示码" value={typed} maxLength={8} placeholder="粘贴 8 位演示码" onChange={e=>setTyped(e.target.value.toUpperCase().trim())}/><button className="community-primary" disabled={typed!==c.code} onClick={()=>advance()}>提交凭证并完成</button></>}</>}
        {done&&<><div className="community-complete">✓</div><p>你已完成知识问答、故事探索、评价和授权凭证体验。</p><button className="community-choice" onClick={receipt}>下载本阶段体验记录</button><a className="community-choice community-wallet-link" href="/?view=app&page=wallet">前往钱包 · 申请提现</a></>}
        {c.completed >= 4 && <details className="community-calculator" aria-label="独立金额计算演示" open={!done}><summary>{done ? "查看金额计算记录" : "金额与佣金计算演示"}</summary>
          <small>CALCULATION EXAMPLE</small><h3>金额与佣金计算演示</h3>
          <p>金额 277.00–298.00 USD · 佣金率 2.50%–3.80%</p>
          {c.exampleQuote ? <>
            <dl><dt>示例金额</dt><dd>{simulatedMoney(c.exampleQuote.amount)}</dd><dt>示例佣金率</dt><dd>{(c.exampleQuote.rate / 100).toFixed(2)}%</dd><dt>计算佣金</dt><dd>{simulatedMoney(c.exampleQuote.commission)}</dd></dl>
            <p className="community-formula">{simulatedMoney(c.exampleQuote.amount)} × {(c.exampleQuote.rate / 100).toFixed(2)}% = {simulatedMoney(c.exampleQuote.commission)}（四舍五入到美分）</p>
            <span className="community-example-saved">{replay ? "本次试用计算" : "已保存"}</span>
          </> : <button className="community-choice" onClick={()=>save({exampleQuote:createExampleQuote()})}>生成一次计算示例</button>}
          
        </details>}
        </>}
        {message&&<p role="status" className="community-message">{message}</p>}
      </section>
      {c.completed > 0 && <details className="community-history" open={!done}><summary>查看阶段记录 · {c.completed} 项</summary>{titles.slice(0,c.completed).map((title,i)=><div key={title}><span>✓</span><b>{title}{i===3 && !c.shared ? " · 已跳过" : ""}</b><small>{(i+1)*20}%</small></div>)}</details>}
      {!done&&<p className="community-next">下一项探索将在完成当前任务后揭晓。</p>}
      <a className="community-wallet" href="/?view=app&page=wallet" onClick={()=>keyboard.hide()}>我的钱包 →</a>
    </div></MobileScroll>
    <JourneyEffects event={effect} onClose={closeEffect}/>
  </div>;
}
