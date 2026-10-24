import {BrandMark} from "../Brand";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  LightningBoltIcon,
  LockClosedIcon,
  ArrowRightIcon,
  EyeOpenIcon,
  EyeClosedIcon,
} from "@radix-ui/react-icons";
import { MobileScroll, KeyboardInput, useKeyboard } from "../mobile";
import { api } from "../api";
export interface CreatorUser {
  id: string;
  email: string;
  created_at: string;
  emailVerified: boolean;
  country?: string;
}
export default function CreatorAccess({
  children,
}: {
  children: (user: CreatorUser, logout: () => Promise<void>) => ReactNode;
}) {
  const [user, setUser] = useState<CreatorUser | null>(null),
    [loading, setLoading] = useState(true),
    [mode, setMode] = useState<"login" | "register">(() =>
      new URLSearchParams(location.search).get("auth") === "register"
        ? "register"
        : "login",
    ),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [inviteCode, setInvite] = useState(""),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const generation = useRef(0), mutation = useRef(false);
  const keyboard = useKeyboard(),
    native =
      new URLSearchParams(location.search).get("view") === "app" ||
      innerWidth <= 600;
  useEffect(() => {
    let live = true;
    const read = () => {
      if (mutation.current) return;
      const version = ++generation.current;
      return api<{ user: CreatorUser | null }>("/auth/session")
        .then((r) => {
          if (live && version === generation.current) {
            setUser(r.user);
            setError("");
          }
        })
        .catch((e) => {
          if (live && version === generation.current) setError(e.message);
        })
        .finally(() => {
          if (live && version === generation.current) setLoading(false);
        });
    };
    void read();
    const expired = (event: Event) => {
      generation.current++;
      setLoading(false);
      setUser(null);
      setPassword("");
      setError(
        (event as CustomEvent<string>).detail || "登录已过期，请重新登录",
      );
    };
    window.addEventListener("creator-session-expired", expired);
    window.addEventListener("focus", read);
    return () => {
      live = false;
      generation.current++;
      window.removeEventListener("creator-session-expired", expired);
      window.removeEventListener("focus", read);
    };
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mutation.current) return;
    if (mode === "register" && password !== confirmation) {
      setError("两次输入的密码不一致");
      return;
    }
    mutation.current = true;
    const version = ++generation.current;
    keyboard.hide();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ user: CreatorUser }>("/auth/" + mode, "POST", {
        email,
        password,
        ...(mode === "register" ? { inviteCode } : {}),
      });
      if (version !== generation.current) return;
      setPassword("");
      setConfirmation("");
      setInvite("");
      setUser(result.user);
    } catch (e) {
      if (version === generation.current) setError((e as Error).message);
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  }
  async function logout() {
    if (mutation.current) return;
    mutation.current = true;
    generation.current++;
    try { await api("/auth/logout", "POST", {}); }
    finally { mutation.current = false; }
    keyboard.hide();
    setUser(null);
    setMode("login");
    setVisible(false);
    setPassword("");
    setConfirmation("");
    setError("");
    history.replaceState(null, "", "/?view=app&page=profile");
  }
  if (user) return <>{children(user, logout)}</>;
  return (
    <div className={"studio s-auth " + (native ? "native-mode" : "")}>
      <MobileScroll className="s-auth-scroll">
        <main className="s-auth-main">
          <a className="s-auth-brand" href="/?view=app">
            <BrandMark />
            <b>
              漫剧 <em>STUDIO</em>
            </b>
          </a>
          <section className="s-auth-story">
            <img src="/art/hero-v2.webp" alt="漫剧故事插画" />
            <div>
              <span>STORIES START WITH YOU</span>
              <h1>
                把好故事，
                <br />
                带给更多人。
              </h1>
              <p>
                你的创作、任务和每一份进展，
                <br />
                从这里开始。
              </p>
            </div>
          </section>
          <section className="s-auth-card">
            <div className="s-auth-tabs">
              <button
                type="button"
                aria-pressed={mode === "login"}
                onClick={() => {
                  keyboard.hide();
                  setMode("login");
                  setError("");
                }}
              >
                登录账号
              </button>
              <button
                type="button"
                aria-pressed={mode === "register"}
                onClick={() => {
                  keyboard.hide();
                  setMode("register");
                  setError("");
                }}
              >
                邀请码注册
              </button>
            </div>
            <h2>{mode === "login" ? "欢迎回来" : "开启你的创作旅程"}</h2>
            <p>
              {mode === "login"
                ? "用邮箱和密码，继续你的故事。"
                : "使用邮箱、密码和邀请码创建账号，无需邮箱验证码。"}
            </p>
            {loading ? (
              <p role="status">正在检查登录状态…</p>
            ) : (
              <form onSubmit={submit}>
                <label>
                  邮箱
                  <KeyboardInput
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="username"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                  />
                </label>
                <label>
                  密码
                  <div className="s-auth-password">
                    <KeyboardInput
                      type={visible ? "text" : "password"}
                      required
                      minLength={8}
                      maxLength={128}
                      autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="至少 8 位字符"
                    />
                    <button
                      type="button"
                      aria-label={visible ? "隐藏密码" : "显示密码"}
                      onClick={() => setVisible(!visible)}
                    >
                      {visible ? <EyeClosedIcon /> : <EyeOpenIcon />}
                    </button>
                  </div>
                </label>
                {mode === "register" && (
                  <>
                    <label>
                      确认密码
                      <KeyboardInput
                        type="password"
                        required
                        minLength={8}
                        maxLength={128}
                        autoComplete="new-password"
                        value={confirmation}
                        onChange={(e) => setConfirmation(e.target.value)}
                        placeholder="再次输入密码"
                      />
                    </label>
                    <label>
                      邀请码
                      <KeyboardInput
                        required
                        maxLength={40}
                        autoComplete="off"
                        value={inviteCode}
                        onChange={(e) => setInvite(e.target.value)}
                        placeholder="输入管理员提供的邀请码"
                      />
                    </label>
                  </>
                )}
                {error && (
                  <div className="s-error-box" role="alert">
                    {error}
                  </div>
                )}
                <button className="s-auth-submit" disabled={busy}>
                  {busy
                    ? "正在处理…"
                    : mode === "login"
                      ? "登录创作者账号"
                      : "注册并进入"}
                  <ArrowRightIcon />
                </button>
              </form>
            )}
            <div className="s-auth-trust">
              <LockClosedIcon />
              <span>
                账号独立保存 · 密码加密存储
                <br />
                为保护账号，平台记录注册及登录 IP 和设备信息，仅用于后台管理
              </span>
            </div>
          </section>
          <footer>漫剧 STUDIO · 创作者工作台</footer>
        </main>
      </MobileScroll>
    </div>
  );
}
