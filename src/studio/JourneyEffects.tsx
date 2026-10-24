import * as Dialog from "@radix-ui/react-dialog";
import { useKeyboard, useScreenPortal } from "../mobile";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  Cross2Icon,
  ReaderIcon,
  StarFilledIcon,
  CheckIcon,
} from "@radix-ui/react-icons";
import "./journey-effects.css";
export type JourneyEvent = {
  kind: "task" | "reward" | "complete";
  amount?: string;
  title?: string;
  subtitle?: string;
  nonce: number;
};
const soundKey = "drama-design-sound-v1";
export function useJourneyAudio() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(soundKey) !== "off";
    } catch {
      return true;
    }
  });
  const context = useRef<AudioContext | null>(null),
    active = useRef(enabled),
    master = useRef<GainNode | null>(null),
    lastPlayed = useRef(-10);
  active.current = enabled;
  const play = useCallback((kind: JourneyEvent["kind"]) => {
    if (!active.current || document.visibilityState === "hidden") return;
    try {
      const audio = context.current ?? (context.current = new AudioContext());
      if (!master.current) {
        master.current = audio.createGain();
        master.current.gain.value = active.current ? 1 : 0;
        master.current.connect(audio.destination);
      }
      const notes =
        kind === "task"
          ? [392, 523.25, 659.25]
          : kind === "reward"
            ? [523.25, 659.25, 783.99, 1046.5]
            : [523.25, 698.46, 880, 1046.5, 1396.91];
      void audio
        .resume()
        .then(() => {
          if (!active.current || audio.currentTime - lastPlayed.current < 0.18)
            return;
          lastPlayed.current = audio.currentTime;
          notes.forEach((frequency, i) => {
            const oscillator = audio.createOscillator(),
              gain = audio.createGain(),
              at = audio.currentTime + i * 0.085;
            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(frequency, at);
            gain.gain.setValueAtTime(0, at);
            gain.gain.linearRampToValueAtTime(0.035, at + 0.012);
            gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.38);
            oscillator.connect(gain);
            gain.connect(master.current!);
            oscillator.start(at);
            oscillator.stop(at + 0.4);
          });
        })
        .catch(() => {});
    } catch {
      /* The visual feedback works independently of browser audio support. */
    }
  }, []);
  useEffect(() => {
    play("task");
    const unlock = () => {
      if (context.current?.state === "suspended" && active.current)
        void context.current.resume().catch(() => {});
    };
    document.addEventListener("pointerdown", unlock, {
      once: true,
      passive: true,
    });
    return () => {
      document.removeEventListener("pointerdown", unlock);
      const current = context.current;
      context.current = null;
      master.current = null;
      lastPlayed.current = -10;
      if (current && current.state !== "closed") void current.close();
    };
  }, [play]);
  function toggle() {
    const next = !enabled;
    active.current = next;
    setEnabled(next);
    if (master.current && context.current)
      master.current.gain.setValueAtTime(
        next ? 1 : 0,
        context.current.currentTime,
      );
    try {
      localStorage.setItem(soundKey, next ? "on" : "off");
    } catch {
      /* Storage may be unavailable. */
    }
    if (next) play("task");
  }
  return { enabled, toggle, play };
}
export default function JourneyEffects({
  event,
  onClose,
  theme,
}: {
  theme?: "gold" | "premium";
  event: JourneyEvent | null;
  onClose: () => void;
}) {
  const card = useRef<HTMLDivElement | null>(null);
  const [artReady, setArtReady] = useState<Record<string, boolean>>({});
  const { screenRef } = useScreenPortal(),
    keyboard = useKeyboard();
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!event) return;
    keyboard.hide();
    const timer = setTimeout(onClose, event.kind === "task" ? 5500 : 7000);
    return () => clearTimeout(timer);
  }, [event, onClose, keyboard.hide]);
  if (!event) return null;
  const reward = event.kind !== "task";
  const artwork = reward
    ? "/art/reward-medal-v1.png"
    : "/art/task-invitation-v1.png";
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal container={screenRef.current}>
        <Dialog.Overlay className="j-modal-backdrop" />
        <Dialog.Content
          className={"j-celebration " + (reward ? "is-reward" : "is-task")+(theme === "premium" ? " j-gold j-premium" : theme === "gold" ? " j-gold" : "")}
          key={event.nonce}
          aria-label={theme === "premium" ? (reward ? "高阶体验完成" : "高阶任务揭晓") : reward ? "奖励提示" : "任务揭晓"}
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            previousFocus.current =
              document.activeElement as HTMLElement | null;
            card.current
              ?.querySelector<HTMLButtonElement>(".j-continue")
              ?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            const prior = previousFocus.current;
            if (
              prior?.isConnected &&
              prior !== document.body &&
              prior !== document.documentElement &&
              !prior.closest('[aria-hidden="true"], [inert]') &&
              prior.getClientRects().length > 0 &&
              !prior.matches(":disabled")
            )
              prior.focus({ preventScroll: true });
            else
              (screenRef.current ?? document)
                ?.querySelector<HTMLElement>(
                  ".a-stage .a-primary,.n-stage .n-current .n-primary",
                )
                ?.focus({ preventScroll: true });
          }}
        >
          <div className="j-atmosphere" aria-hidden="true" />
          <div className="j-burst" aria-hidden="true">
            {Array.from({ length: 20 }, (_, i) => (
              <i
                key={i}
                style={
                  {
                    "--i": i,
                    "--distance": `${100 + (i % 4) * 30}px`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
          {theme === "premium"&&<div className={"premium-cinematic "+(reward?"is-earned":"is-opening")} aria-hidden="true"><div className="premium-beams"/><div className="premium-halo halo-one"/><div className="premium-halo halo-two"/><div className="premium-case"><div className="premium-case-back"/><div className="premium-case-leaves"><i/><i/><i/></div><div className="premium-case-front"><span>STUDIO</span><b>{reward?'✦':'◆'}</b><strong>{reward?'COMPLETED':'FULL SERIES'}</strong><small>PREMIUM COLLECTION</small></div><div className="premium-case-seal">{reward?'✓':'全集'}</div></div><div className="premium-floor"/></div>}
          <div className="j-celebration-card" ref={card}>
            <button
              className="j-close"
              aria-label="关闭动画提示"
              onClick={onClose}
            >
              <Cross2Icon />
            </button>
            <span className="j-demo">预览版</span>
            <div
              className={"j-emblem" + (artReady[artwork] ? " art-ready" : "")}
              aria-hidden="true"
            >
              <div className="j-ring" />
              <div className="j-medal">
                {event.kind === "complete" ? (
                  <CheckIcon />
                ) : reward ? (
                  <StarFilledIcon />
                ) : (
                  <ReaderIcon />
                )}
              </div>
              <img
                className="j-artwork"
                src={artwork}
                alt=""
                onLoad={() =>
                  setArtReady((old) => ({ ...old, [artwork]: true }))
                }
              />
              <i />
              <i />
            </div>
            <small>
              {theme === "premium" ? (reward ? "PREMIUM EXPERIENCE COMPLETE" : "EXCLUSIVE COLLECTION UNSEALED") : event.kind === "task"
                ? "A NEW STORY AWAITS"
                : event.kind === "reward"
                  ? "REWARD UNLOCKED"
                  : "CHAPTER COMPLETE"}
            </small>
            <Dialog.Title asChild>
              <h2>
                {event.title ??
                  (event.kind === "task"
                    ? "神秘任务已抵达"
                    : event.kind === "reward"
                      ? "佣金已结算"
                      : "这一章，圆满完成")}
              </h2>
            </Dialog.Title>
            {event.amount && (
              <strong>
                {event.amount}
                <span>{event.kind === "complete" ? "累计 USD" : "USD"}</span>
              </strong>
            )}
            <Dialog.Description asChild>
              <p>
                {event.subtitle ??
                  (reward
                    ? "奖励已计入本章记录。"
                    : "揭开属于你的这一次创作。")}
              </p>
            </Dialog.Description>
            <button className="j-continue" onClick={onClose}>
              {reward ? "收下这份成就" : "查看这次任务"} <span>→</span>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
