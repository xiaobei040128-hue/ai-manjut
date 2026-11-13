import SupportContact from './SupportContact';
import AppScroll from './AppScroll';
import {useLanguage} from '../i18n/language';
import LanguageSelector from '../i18n/LanguageSelector';
import {translateText as tx,localizeNode as lx} from "../i18n/translate";
import {navigateApp} from './app-navigation';
import {cleanDevelopmentAppCache} from './app-cache';
import './creator-access-fantasy.css';
import RegistrationReward from "./RegistrationReward";
import {unlockWelcomeAudio} from "./welcome-audio";
import {BrandMark,BrandLockup} from "../Brand";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  LightningBoltIcon,
  LockClosedIcon,
  ArrowRightIcon,
  EyeOpenIcon,
  EyeClosedIcon,
} from "@radix-ui/react-icons";
import { KeyboardInput, useKeyboard } from "../mobile";
import { api } from "../api";
export interface CreatorUser {
  reputation_score?: number;
  username?: string | null;
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
  const activeLanguage=useLanguage();
  const [user, setUser] = useState<CreatorUser | null>(null),
    [loading, setLoading] = useState(true),
    [mode, setMode] = useState<"login" | "register">(() =>
      new URLSearchParams(location.search).get("auth") === "register"
        ? "register"
        : "login",
    ),
    [email, setEmail] = useState(""),
    [username,setUsername]=useState(""),
    [accountType,setAccountType]=useState<"email"|"phone">("email"),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [inviteCode, setInvite] = useState(()=>new URLSearchParams(location.search).get('invite')||''),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [registrationReward,setRegistrationReward]=useState<{id:string;amount:number}|null>(null);
  const generation = useRef(0), mutation = useRef(false);
  useEffect(()=>{if(!user)document.title=tx(mode==='register'?'注册':'登录')+' · AI CREATOR';});
  const keyboard = useKeyboard(),
    native =
      import.meta.env.PROD || new URLSearchParams(location.search).get("view") === "app" ||
      innerWidth <= 600;
  useEffect(() => {
    void cleanDevelopmentAppCache();
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
      setRegistrationReward(null);
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
    if (mode === "register") void unlockWelcomeAudio();
    mutation.current = true;
    const version = ++generation.current;
    keyboard.hide();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ user: CreatorUser; registrationReward?:{id:string;amount:number} }>("/auth/" + mode, "POST", {
        account:mode==='register'&&accountType==='phone'?'+'+email:email,
        password,
        ...(mode === "register" ? { inviteCode,username } : {}),
      });
      if (version !== generation.current) return;
      setPassword("");
      setConfirmation("");
      setInvite("");
      if(mode==='register'&&result.registrationReward)setRegistrationReward(result.registrationReward);
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
    setRegistrationReward(null);
    setMode("login");
    setVisible(false);
    setPassword("");
    setConfirmation("");
    setError("");
    history.replaceState(null, "", "/?page=profile");
  }
  if (user) return <>{lx(children(user, logout))}{lx(registrationReward&&<RegistrationReward amount={registrationReward.amount} onClose={()=>setRegistrationReward(null)} onStart={()=>{setRegistrationReward(null);navigateApp('/?design=third');}}/>)}</>;
  if (loading) return <div className={"studio s-auth fantasy-access " + (native ? "native-mode" : "")}><main className="s-auth-main"><div className="access-header"><div className="s-auth-brand"><BrandMark/><BrandLockup/></div><LanguageSelector compact/></div><p role="status">{tx("正在加载你的创作空间…")}</p></main></div>;
  return (
    <div className={"studio s-auth fantasy-access " + (native ? "native-mode" : "")}>
      <AppScroll className="s-auth-scroll">
        <main className="s-auth-main">
          <div className="access-header"><a className="s-auth-brand" href="/">
            <BrandMark />
            <BrandLockup/>
          </a><LanguageSelector compact/></div>
          <section className="s-auth-story">
            <img src="/art/studio-access-fantasy-20261026.webp" alt={tx("月光城堡与漫剧分镜环绕的故事书房")} />
            <div>
              <span>{tx("STORIES START WITH YOU")}</span>
              <h1>{tx("把好故事，")}<br />{tx("带给更多人。")}</h1>
              <p>{tx("你的创作、任务和每一份进展，")}<br />{tx("从这里开始。")}</p>
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
              >{tx("登录账号")}</button>
              <button
                type="button"
                aria-pressed={mode === "register"}
                onClick={() => {
                  keyboard.hide();
                  setMode("register");
                  setError("");
                }}
              >{tx("邀请码注册")}</button>
            </div>
            <h2>{lx(mode === "login" ? "欢迎回来" : "开启你的创作旅程")}</h2>
            <p>
              {lx(mode === "login"
                ? "使用用户名、邮箱或手机号登录。"
                : "设置用户名，并使用邮箱或手机号注册。")}
            </p>
            {lx(loading ? (
              <p role="status">{tx("正在检查登录状态…")}</p>
            ) : (
              <form onSubmit={submit}>
                {mode==='register'&&<label>{tx('用户名')}<KeyboardInput required maxLength={254} autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder={tx('用户名')}/></label>}
                {mode==='register'&&<div className="auth-account-tabs" role="group" aria-label={tx("账号类型")}><button type="button" aria-pressed={accountType==='email'} onClick={()=>{setAccountType('email');setEmail('');}}>{tx('邮箱')}</button><button type="button" aria-pressed={accountType==='phone'} onClick={()=>{setAccountType('phone');setEmail('');}}>{tx('手机号')}</button></div>}
                <label>{tx(mode==='login'?'用户名 / 邮箱 / 手机号':accountType==='phone'?'手机号':'邮箱')}<div className={mode==='register'&&accountType==='phone'?'auth-phone-input':'auth-email-input'}>
                    {mode==='register'&&accountType==='phone'&&<span className="auth-phone-prefix" aria-hidden="true">+</span>}
                    <KeyboardInput aria-label={tx(mode==='login'?'用户名 / 邮箱 / 手机号':accountType==='phone'?'手机号':'邮箱')} type={mode==='login'?'text':accountType==='phone'?'tel':'email'} required maxLength={mode==='register'&&accountType==='phone'?15:254} autoComplete={mode==='login'?'username':'off'} inputMode={mode==='login'?'text':accountType==='phone'?'tel':'email'} value={email} onChange={e=>setEmail(mode==='register'&&accountType==='phone'?e.target.value.replace(/\D/g,''):e.target.value)} pattern={mode==='register'&&accountType==='phone'?'[1-9][0-9]{6,14}':undefined} placeholder={tx(mode==='login'?'用户名、邮箱或带区号的手机号':accountType==='phone'?'12025550123':'your@email.com')}/>
                  </div>
                </label>
                <label>{tx("密码")}<div className="s-auth-password">
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
                      placeholder={tx("至少 8 位字符")}
                    />
                    <button
                      type="button"
                      aria-label={tx(visible ? "隐藏密码" : "显示密码")}
                      onClick={() => setVisible(!visible)}
                    >
                      {lx(visible ? <EyeClosedIcon /> : <EyeOpenIcon />)}
                    </button>
                  </div>
                </label>
                {lx(mode === "register" && (
                  <>
                    <label>{tx("确认密码")}<KeyboardInput
                        type="password"
                        required
                        minLength={8}
                        maxLength={128}
                        autoComplete="new-password"
                        value={confirmation}
                        onChange={(e) => setConfirmation(e.target.value)}
                        placeholder={tx("再次输入密码")}
                      />
                    </label>
                    <label>{tx("邀请码")}<KeyboardInput
                        required
                        maxLength={40}
                        autoComplete="off"
                        value={inviteCode}
                        onChange={(e) => setInvite(e.target.value)}
                        placeholder={tx("邀请码")}
                      />
                    </label>
                  </>
                ))}
                {lx(error && (
                  <div className="s-error-box" role="alert">
                    {lx(error)}
                  </div>
                ))}
                <button className="s-auth-submit" disabled={busy}>
                  {lx(busy
                    ? "正在处理…"
                    : mode === "login"
                      ? "登录创作者账号"
                      : "注册并进入")}
                  <ArrowRightIcon />
                </button>
              </form>
            ))}
            <div className="auth-support-entry"><SupportContact variant="header" publicAccess/></div>
          </section>
        </main>
      </AppScroll>
    </div>
  );
}
