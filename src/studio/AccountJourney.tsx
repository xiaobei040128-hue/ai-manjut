import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { api } from "../api";
import type { NewcomerSession } from "./newcomerState";
import type { Simulation } from "./stageSimulation";
type Journey = {
  ownerId: string;
  newcomer: NewcomerSession;
  advanced: Simulation;
  revision: number;
  updatedAt: string;
  simulationOnly: true;
};
type JourneyContext = Journey & {
  setNewcomer: Dispatch<SetStateAction<NewcomerSession>>;
  setAdvanced: Dispatch<SetStateAction<Simulation>>;
  flush: () => Promise<void>;
};
const Context = createContext<JourneyContext | null>(null);
export function useAccountJourney() {
  const value = useContext(Context);
  if (!value) throw new Error("阶段需要登录账号");
  return value;
}
export default function AccountJourney({
  ownerId,
  children,
}: {
  ownerId: string;
  children: ReactNode;
}) {
  const [journey, setJourney] = useState<Journey | null>(null),
    [error, setError] = useState("");
  const current = useRef<Journey | null>(null),
    revision = useRef(0),
    queue = useRef<Promise<void>>(Promise.resolve()),
    pending = useRef(0),
    blocked = useRef(false),
    alive = useRef(true);
  const read = useCallback(async () => {
    setError("");
    try {
      const value = await api<Journey>("/journey");
      if (value.ownerId !== ownerId)
        throw new Error("登录账号已改变，请刷新页面");
      if (alive.current) {
        current.current = value;
        revision.current = value.revision;
        blocked.current = false;
        setJourney(value);
      }
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    }
  }, [ownerId]);
  useEffect(() => {
    alive.current = true;
    void read();
    const focus = () => {
      if (!pending.current) void read();
    };
    const leaving = (event: BeforeUnloadEvent) => {
      if (pending.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("focus", focus);
    window.addEventListener("beforeunload", leaving);
    return () => {
      alive.current = false;
      window.removeEventListener("focus", focus);
      window.removeEventListener("beforeunload", leaving);
    };
  }, [read]);
  function update<K extends "newcomer" | "advanced">(
    kind: K,
    change: SetStateAction<Journey[K]>,
  ) {
    if (!current.current || blocked.current) return;
    const old = current.current[kind],
      value =
        typeof change === "function"
          ? (change as (old: Journey[K]) => Journey[K])(old)
          : change;
    if (value === old) return;
    current.current = { ...current.current, [kind]: value };
    setJourney(current.current);
    pending.current++;
    queue.current = queue.current
      .then(async () => {
        if (blocked.current || !alive.current) return;
        try {
          const saved = await api<Journey>("/journey", "PATCH", {
            ownerId,
            kind,
            value,
            revision: revision.current,
          });
          if (saved.ownerId !== ownerId) throw new Error("账号进度不匹配");
          revision.current = saved.revision;
        } catch (e) {
          blocked.current = true;
          if (alive.current) setError((e as Error).message);
        }
      })
      .finally(() => {
        pending.current--;
      });
  }
  const flush = useCallback(async () => {
    await queue.current;
  }, []);
  if (!journey)
    return (
      <div className="studio u-preview-loading native-mode" role="status">
        <p>{error || "正在读取账号进度…"}</p>
        {error && <button onClick={() => void read()}>重试</button>}
      </div>
    );
  return (
    <Context.Provider
      value={{
        ...journey,
        setNewcomer: (value) => update("newcomer", value),
        setAdvanced: (value) => update("advanced", value),
        flush,
      }}
    >
      <div
        style={{ display: "contents" }}
        onClickCapture={(event) => {
          const anchor = (event.target as HTMLElement).closest("a");
          if (
            !anchor ||
            anchor.target === "_blank" ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            !pending.current
          )
            return;
          const url = new URL(anchor.href, location.href);
          if (url.origin !== location.origin || url.pathname !== "/") return;
          event.preventDefault();
          void flush().then(() => {
            if (alive.current && !blocked.current) location.assign(url.href);
          });
        }}
      >
        {children}
      </div>
      {error && (
        <aside className="s-journey-sync-error" role="alert">
          <span>{error}。当前更改尚未确认保存。</span>
          <button onClick={() => void flush().then(read)}>重新读取</button>
        </aside>
      )}
    </Context.Provider>
  );
}
