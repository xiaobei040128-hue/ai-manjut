import {translateText as tx,localizeNode as lx} from "../i18n/translate";
import * as Dialog from "@radix-ui/react-dialog";
import { useKeyboard, useScreenPortal } from "../mobile";
import {
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
export default function JourneyEffects({
  event,
  onClose,
  theme,
  autoClose = true,
}: {
  theme?: "gold" | "premium";
  autoClose?: boolean;
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
    if (!autoClose) return;
    const timer = setTimeout(onClose, event.kind === "task" ? 5500 : 7000);
    return () => clearTimeout(timer);
  }, [event, onClose, keyboard.hide, autoClose]);
  if (!event) return null;
  const reward = event.kind !== "task";
  const artwork = reward
    ? "/art/reward-medal-v1.webp"
    : "/art/task-invitation-v1.webp";
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal container={screenRef.current}>
        <Dialog.Overlay className="j-modal-backdrop" />
        <Dialog.Content
          className={"j-celebration " + (reward ? "is-reward" : "is-task")+(theme === "premium" ? " j-gold j-premium" : theme === "gold" ? " j-gold" : "")}
          key={event.nonce}
          aria-label={tx(theme === "premium" ? (reward ? "高阶体验完成" : "高阶任务揭晓") : reward ? "奖励提示" : "任务揭晓")}
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
            {lx(Array.from({ length: 20 }, (_, i) => (
              <i
                key={i}
                style={
                  {
                    "--i": i,
                    "--distance": `${100 + (i % 4) * 30}px`,
                  } as CSSProperties
                }
              />
            )))}
          </div>
          {lx(theme === "premium"&&<div className={"premium-cinematic "+(reward?"is-earned":"is-opening")} aria-hidden="true"><div className="premium-beams"/><div className="premium-halo halo-one"/><div className="premium-halo halo-two"/><div className="premium-case"><div className="premium-case-back"/><div className="premium-case-leaves"><i/><i/><i/></div><div className="premium-case-front"><span>{tx("STUDIO")}</span><b>{lx(reward?'✦':'◆')}</b><strong>{lx(reward?'COMPLETED':'FULL SERIES')}</strong><small>{tx("PREMIUM COLLECTION")}</small></div><div className="premium-case-seal">{lx(reward?'✓':'全集')}</div></div><div className="premium-floor"/></div>)}
          <div className="j-celebration-card" ref={card}>
            <button
              className="j-close"
              aria-label={tx("关闭动画提示")}
              onClick={onClose}
            >
              <Cross2Icon />
            </button>
            <div
              className={"j-emblem" + (artReady[artwork] ? " art-ready" : "")}
              aria-hidden="true"
            >
              <div className="j-ring" />
              <div className="j-medal">
                {lx(event.kind === "complete" ? (
                  <CheckIcon />
                ) : reward ? (
                  <StarFilledIcon />
                ) : (
                  <ReaderIcon />
                ))}
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
              {lx(theme === "premium" ? (reward ? "PREMIUM EXPERIENCE COMPLETE" : "EXCLUSIVE COLLECTION UNSEALED") : event.kind === "task"
                ? "A NEW STORY AWAITS"
                : event.kind === "reward"
                  ? "REWARD UNLOCKED"
                  : "CHAPTER COMPLETE")}
            </small>
            <Dialog.Title asChild>
              <h2>
                {lx(event.title ??
                  (event.kind === "task"
                    ? "神秘任务已抵达"
                    : event.kind === "reward"
                      ? "佣金已结算"
                      : "这一章，圆满完成"))}
              </h2>
            </Dialog.Title>
            {lx(event.amount && (
              <strong>
                {lx(event.amount)}
                <span>{lx(event.kind === "complete" ? "累计 USD" : "USD")}</span>
              </strong>
            ))}
            <Dialog.Description asChild>
              <p>
                {lx(event.subtitle ??
                  (reward
                    ? "奖励已计入本章记录。"
                    : "揭开属于你的这一次创作。"))}
              </p>
            </Dialog.Description>
            <button className="j-continue" onClick={onClose}>
              {lx(reward ? "收下这份成就" : "查看这次任务")} <span>→</span>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
