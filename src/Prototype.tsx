import LanguageSelector from './i18n/LanguageSelector';
import {useLanguage} from './i18n/language';
import {translateText as tx,localizeNode as lx} from "./i18n/translate";
import ProfileAccountId from './studio/ProfileAccountId';
import SupportContact from './studio/SupportContact';
import AccountSecurity from './studio/AccountSecurity';
import {HomeIcon,RecordsIcon as ReaderIcon,WalletIcon as CardStackIcon,ProfileIcon as PersonIcon} from './studio/PlatformIcons';
import {cleanDevelopmentAppCache} from './studio/app-cache';
import ThirdCopyright from './studio/ThirdCopyright';
import {readStoryFavorites} from './studio/story-favorites';
import {navigateApp} from './studio/app-navigation';
import Notifications from "./studio/Notifications";
import {BrandMark,BrandLockup,NotificationIcon} from "./Brand";
import "./visual-refresh.css";
import {AccountReadiness} from "./studio/AccountOverview";
import StageWork from "./studio/StageWork";
import StageHub from "./studio/StageHub";
import DesignBoundary from "./studio/DesignBoundary";
import "./studio/platform-upgrade.css";
import "./studio/experience-v3.css";
import "./studio/page-polish.css";
import "./studio/account-pages.css";
import "./studio/main-navigation.css";
import FinancePanel from "./studio/FinancePanel";
import CreatorAccess, { type CreatorUser } from "./studio/CreatorAccess";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DashboardIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Cross2Icon,
  MagnifyingGlassIcon,
  BellIcon,
  StarIcon,
  StarFilledIcon,
  ArrowRightIcon,
  ArrowTopRightIcon,
  CheckIcon,
  CheckCircledIcon,
  ClockIcon,
  PlusIcon,
  DownloadIcon,
  UploadIcon,
  TrashIcon,
  Pencil1Icon,
  ImageIcon,
  FileTextIcon,
  VideoIcon,
  LockClosedIcon,
  LightningBoltIcon,
  UpdateIcon,
  ExclamationTriangleIcon,
  MixerHorizontalIcon,
  ExternalLinkIcon,
  ArchiveIcon,
  MobileIcon,
} from "@radix-ui/react-icons";
import {
  MobileScroll,
  Carousel,
  KeyboardInput,
  KeyboardTextarea,
  BottomSheet,
  useKeyboard,
  useKeyboardInsets,
  useScreenPortal,
} from "./mobile";
import {
  api,
  fileData,
  money,
  date,
  timeLeft,
  statusText,
  type Assignment,
  type Bootstrap,
  type Task,
  type Upload,
  type Material,
  type InstallPrompt,
  uploadMaterial,
  fileSize,
} from "./api";
import SubmissionHistory from "./studio/SubmissionHistory";
import { createPortal } from "react-dom";
const HelpCenter = lazy(() => import("./studio/HelpCenter"));
const StoryCatalog = lazy(() => import("./studio/StoryCatalog"));
function DesignPreview({ children }: { children: ReactNode }) {
  const native =
    new URLSearchParams(location.search).get("view") === "app" ||
    window.innerWidth <= 600;
  return (
    <DesignBoundary>
      <Suspense
        fallback={
          <div
            className={
              "studio u-preview-loading" + (native ? " native-mode" : "")
            }
            role="status"
            aria-busy="true"
          >
            <div>
              <LightningBoltIcon />
              <span>{tx("STUDIO")}</span>
              <h2>{tx("正在准备这一章的故事")}</h2>
              <p>{tx("界面即将呈现…")}</p>
            </div>
          </div>
        }
      >
        {lx(children)}
      </Suspense>
    </DesignBoundary>
  );
}
const customerLedgerNote=(r:{kind:string;note:string})=>r.kind==='admin_credit'?r.note.replace(/^后台上分/,'余额调增'):r.kind==='admin_debit'?r.note.replace(/^后台下分/,'余额调减'):r.kind==='withdraw_hold'?r.note.replace(/^提现申请冻结/,'提现处理中'):r.note;
type Page =
  | "discover"
  | "help"
  | "home"
  | "hall"
  | "detail"
  | "tasks"
  | "assignment"
  | "submit"
  | "wallet"
  | "profile"
  | "notices"
  | "reviews"
  | "manage"
  | "publish"
  | "saved"
  | "assets";
const pageTitles: Record<Page, string> = {
  discover: "光影剧场",
  help: "帮助与服务",
  home: "AI CREATOR",
  hall: "任务大厅",
  detail: "任务详情",
  tasks: "我的任务",
  assignment: "任务进度",
  submit: "提交作品",
  wallet: "我的钱包",
  profile: "创作者中心",
  notices: "消息通知",
  reviews: "审核工作台",
  manage: "任务管理",
  publish: "发布新任务",
  saved: "我的收藏",
  assets: "素材管理",
};
function readRoute() {
  const params = new URLSearchParams(location.search);
  let page = (params.get("page") || "home") as Page;
  if (!(page in pageTitles)) {page = "home";params.delete("page");history.replaceState(null,"","/?"+params.toString());}
  if (["reviews", "manage", "publish", "assets"].includes(page))
    page = "profile";
  const taskId = params.get("task") || "";
  const assignmentId = params.get("assignment") || "";
  if (["assignment", "submit"].includes(page) && !assignmentId) page = "tasks";
  return { page, taskId, assignmentId };
}
const tabs = ["全部", "进行中", "审核中", "待修改", "已完成", "已取消"];
const navItems = [
  { page: "home", label: "首页", Icon: HomeIcon },
  { page: "hall", label: "任务大厅", Icon: DashboardIcon },
  { page: "tasks", label: "我的任务", Icon: ReaderIcon },
  { page: "wallet", label: "钱包", Icon: CardStackIcon },
  { page: "profile", label: "我的", Icon: PersonIcon },
] as const;
const initialForm = {
  title: "",
  platform: "TikTok",
  language: "中文",
  genre: "都市爱情",
  episodes: "30",
  deposit: "100",
  commission: "20",
  posts: "3",
  slots: "30",
  description: "",
  cover: "/art/hero-v2.webp",
};
function Button({
  children,
  onClick,
  disabled = false,
  kind = "primary",
  className = "",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  kind?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`s-button ${kind} ${className}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
    >
      {lx(children)}
    </button>
  );
}
function Platform({ name }: { name: string }) {
  return (
    <span className={"s-platform " + name.toLowerCase()}>
      <VideoIcon />
      {lx(name)}
    </span>
  );
}
function Empty({
  title,
  description,
  children,
  icon: Icon = ReaderIcon,
}: {
  title: string;
  description: string;
  children?: ReactNode;
  icon?: typeof ReaderIcon;
}) {
  return (
    <div className="s-empty">
      <div className="s-empty-icon">
        <Icon />
      </div>
      <h3>{lx(title)}</h3>
      <p>{lx(description)}</p>
      {lx(children)}
    </div>
  );
}
function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="s-section">
      <div className="s-section-heading">
        <h2>{lx(title)}</h2>
        {lx(action)}
      </div>
      {lx(children)}
    </section>
  );
}
function TaskCard({
  t,
  onDetail,
  onBookmark,
  busy,
}: {
  t: Task;
  onDetail: (task: Task) => void;
  onBookmark: (task: Task) => void;
  busy: boolean;
}) {
  return (
    <article className={"s-task-card" + (!t.active ? " paused" : "")}>
      <button
        className="s-task-cover"
        onClick={() => onDetail(t)}
        aria-label={tx("查看" + t.title)}
      >
        <img src={t.cover} alt={tx(t.title)} />
        {lx((t.badge || !t.active) && <span>{lx(t.active ? t.badge : "已暂停")}</span>)}
      </button>
      <div className="s-task-content">
        <button className="s-task-title" onClick={() => onDetail(t)}>
          {lx(t.title)}
        </button>
        <div className="s-task-meta">
          <Platform name={t.platform} />
          <span>
            {lx(t.episodes)}{tx(" 集 · ")}{lx(t.language)}
          </span>
        </div>
        <p className="s-task-description">
          {lx(t.genre)}{tx(" · 发布 ")}{lx(t.posts)}{tx("条视频")}</p>
        <button className="s-text-button" onClick={() => onDetail(t)}>{tx("查看剧集与素材")}<ArrowRightIcon />
        </button>
        <div className="s-task-foot">
          <span>{tx("故事收藏")}</span>
        </div>
      </div>
      <button
        disabled={busy}
        className={"s-bookmark " + (t.bookmarked ? "saved" : "")}
        aria-label={tx((t.bookmarked ? "取消收藏" : "收藏") + t.title)}
        onClick={() => onBookmark(t)}
      >
        {lx(t.bookmarked ? <StarFilledIcon /> : <StarIcon />)}
      </button>
    </article>
  );
}

function AssignmentCard({
  a,
  onOpen,
}: {
  a: Assignment;
  onOpen: (a: Assignment) => void;
}) {
  return (
    <button className="s-owned-card" onClick={() => onOpen(a)}>
      <div className="s-owned-top">
        <img src={a.task.cover} alt="" />
        <div>
          <h3>{lx(a.task.title)}</h3>
          {lx(a.task.stage===3?<span className="s-platform">{lx(a.task.premium?'高阶任务 · 全集版权':'作品版权任务')}</span>:<Platform name={a.task.platform} />)}
          <p>
            {lx(a.task.stage===3?'版权任务':`发布 ${a.task.posts} 条`)} · {lx(date(a.created_at))}
          </p>
        </div>
        <span className={"s-status " + a.status}>{lx(statusText[a.status])}</span>
      </div>
      <div className="u-owned-meta">
        <span>#{lx(a.id.slice(0, 8).toUpperCase())}</span>
        <span>
          {lx(a.task.stage === 3
            ? a.status === "completed" ? "版权码已核验" : "复制并提交版权码"
            : ["active", "revision"].includes(a.status)
              ? `${(a.draft.links || []).filter(Boolean).length}/${a.task.posts} 条草稿链接 · ${a.uploads.length} 张截图`
              : `累计提交 ${a.submissions.length} 次`)}
        </span>
      </div>
      <div className="s-owned-bottom">
        <span>
          {lx(a.status === "completed" ? "佣金已到账" : "任务佣金")}{lx(" ")}
          <b>{lx(money(a.task.commission))}</b>
        </span>
        <span>
          {lx(["active", "revision"].includes(a.status)
            ? "剩余 " + timeLeft(a.deadline)
            : a.status === "review"
              ? "等待审核"
              : "查看详情")}{lx(" ")}
          <ChevronRightIcon />
        </span>
      </div>
      {lx(a.status === "revision" && (
        <p className="s-revision-note">
          <ExclamationTriangleIcon />
          {lx(a.review_note)}
        </p>
      ))}
    </button>
  );
}

export default function Prototype() {
 useLanguage();
  return (
    <CreatorAccess>
      {lx((user, logout) => (
        <div style={{display:"contents"}} onClick={event => {
          if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
          if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
          const next = new URL(anchor.href, location.href);
          if (next.origin === location.origin && next.pathname === '/' && next.searchParams.get('view') === 'app') {
            event.preventDefault();
            navigateApp(next.href);
          }
        }}>
          <AccountContent user={user} logout={logout} />
        </div>
      ))}
    </CreatorAccess>
  );
}
function AccountContent({
  user,
  logout,
}: {
  user: CreatorUser;
  logout: () => Promise<void>;
}) {
  const [route, setRoute] = useState(location.search);
  useEffect(() => {
    const update = () => setRoute(location.search);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  const query = new URLSearchParams(route);
  const design = query.get("design");
  if (design && ['newcomer','advanced','third'].includes(design)) return <DesignPreview><StageWork key={design} stage={design==='newcomer'?1:design==='advanced'?2:3}/></DesignPreview>;
  if (query.get('copyright') === '1' && query.get('assignment')) return <DesignPreview><ThirdCopyright key={user.id+query.get('assignment')} assignmentId={query.get('assignment')!}/></DesignPreview>;
  return (
    <Studio
      key={user.id}
      user={user}
      logout={async () => {
        await logout();
      }}
    />
  );
}
function Studio({
  user,
  logout,
}: {
  user: CreatorUser;
  logout: () => Promise<void>;
}) {
  const activeLanguage=useLanguage();
  const initialRoute = useRef(readRoute());
  const externalWalletEntry = useRef(initialRoute.current.page === "wallet");
  const storyFavoriteCount = readStoryFavorites(user.id).length;
  const routeMode = useRef<"push" | "replace" | "pop">("replace");
  const routeDepth = useRef(Number(window.history.state?.studioDepth) || 0);
  const nativeMode =
    new URLSearchParams(location.search).get("view") === "app" ||
    window.innerWidth <= 600;
  const [data, setData] = useState<Bootstrap | null>(null),
    [page, setPage] = useState<Page>(initialRoute.current.page),
    [initialError, setInitialError] = useState(""),
    [busy, setBusy] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [connectionError, setConnectionError] = useState(""),
    [toast, setToast] = useState<{ message: string; error?: boolean } | null>(
      null,
    );
  const [taskId, setTaskId] = useState(initialRoute.current.taskId),
    [assignmentId, setAssignmentId] = useState(
      initialRoute.current.assignmentId,
    ),
    [platform, setPlatform] = useState("全部"),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState("推荐"),
    [genre, setGenre] = useState("全部题材"),
    [tab, setTab] = useState("全部"),
    [ledgerFilter, setLedgerFilter] = useState("全部");
  const [modal, setModal] = useState<string | null>(null),
    [preview, setPreview] = useState<{ src: string; name: string } | null>(
      null,
    ),
    [links, setLinks] = useState<string[]>([]),
    [note, setNote] = useState(""),
    [selectedUploads, setSelectedUploads] = useState<string[]>([]),
    [draftState, setDraftState] = useState(""),
    [reviewer, setReviewer] = useState(false),
    [reviewReason, setReviewReason] = useState(""),
    [reviewChecks, setReviewChecks] = useState([false, false, false]),
    [accepted, setAccepted] = useState(false),
    [uploading, setUploading] = useState(false);
  const [profileForm, setProfileForm] = useState({
      name: "",
      bio: "",
      channel: "",
    }),
    [form, setForm] = useState(initialForm),
    [managed, setManaged] = useState<Task[]>([]),
    [showFilters, setShowFilters] = useState(false);
  const [assetAll, setAssetAll] = useState<Material[]>([]),
    [assetView, setAssetView] = useState("active"),
    [uploadProgress, setUploadProgress] = useState(0),
    [uploadName, setUploadName] = useState(""),
    [videoPreview, setVideoPreview] = useState<Material | null>(null),
    [archiveTarget, setArchiveTarget] = useState<Material | null>(null),
    [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null),
    [serviceWorkerReady, setServiceWorkerReady] = useState(false);
  const [ledgerExpanded,setLedgerExpanded]=useState(false);
  const [ledgerSearch, setLedgerSearch] = useState(""),
    [taskSearch, setTaskSearch] = useState("");
  const materialRef = useRef<HTMLInputElement>(null);
  const [loadedTask, setLoadedTask] = useState<Task | null>(null);
  const [routeError, setRouteError] = useState("");
  const submittedDraft = useRef(false);
  const pendingDraft = useRef<{
    id: string;
    links: string[];
    note: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null),
    coverRef = useRef<HTMLInputElement>(null),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyboard = useKeyboard(),
    insets = useKeyboardInsets(),
    { screenRef } = useScreenPortal();
  const assignment = data?.assignments.find((a) => a.id === assignmentId),
    task =
      data?.tasks.find((t) => t.id === taskId) ||
      data?.savedTasks?.find((t) => t.id === taskId) ||
      data?.assignments.find((a) => a.task_id === taskId)?.task ||
      managed.find((t) => t.id === taskId) ||
      (loadedTask?.id === taskId ? loadedTask : undefined);
  const hasNav = navItems.some((n) => n.page === page),
    showFooter =
      ["detail", "submit"].includes(page) ||
      (page === "assignment" && assignment);
  const currentClaim = data?.assignments.find(
    (a) =>
      a.task_id === taskId &&
      ["active", "review", "revision"].includes(a.status),
  );
  const say = useCallback((message: string, error = false) => {
    setToast({ message, error });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  }, []);
  const refresh = useCallback(async () => {
    try {
      const next = await api<Bootstrap>("/bootstrap");
      setData(next);
      setInitialError("");
      setConnectionError("");
      return next;
    } catch (e) {
      setConnectionError((e as Error).message);
      throw e;
    }
  }, []);
  useEffect(() => {
    refresh().catch((e) => setInitialError(e.message));
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [refresh]);
  useEffect(() => {
    const update = () => refresh().catch(() => {});
    window.addEventListener("focus", update);
    window.addEventListener("online", update);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") update();
    }, 15000);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", update);
      window.removeEventListener("online", update);
    };
  }, [refresh]);
  useEffect(() => {
    void cleanDevelopmentAppCache();
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    if (import.meta.env.PROD && "serviceWorker" in navigator)
      navigator.serviceWorker
        .register("/sw.js",{updateViaCache:"none"})
        .then(registration => {void registration.update();return navigator.serviceWorker.ready;})
        .then(() => setServiceWorkerReady(true))
        .catch(() => {});
    return () => window.removeEventListener("beforeinstallprompt", onInstall);
  }, []);
  useEffect(() => {
    if (page === "assets")
      api<{ materials: Material[] }>("/tasks/" + taskId + "/materials?all=1")
        .then((r) => setAssetAll(r.materials))
        .catch((e) => say(e.message, true));
  }, [page, taskId, data, say]);
  useEffect(() => {
    setRouteError("");
    if (!["detail", "assets"].includes(page) || !data || task) return;
    let live = true;
    api<Task>("/tasks/" + encodeURIComponent(taskId))
      .then((result) => {
        if (live) setLoadedTask(result);
      })
      .catch((e) => {
        if (live) setRouteError(e.message);
      });
    return () => {
      live = false;
    };
  }, [page, taskId, !!data, !!task]);
  useLayoutEffect(() => {
    screenRef.current?.scrollTo(0, 0);
  }, [page, screenRef]);
  useEffect(()=>{document.title=tx(page === "home" ? "AI CREATOR · 创作者工作台" : pageTitles[page]+" · AI CREATOR");});
  useEffect(() => {

    if (routeMode.current === "pop") {
      routeMode.current = "replace";
      return;
    }
    const url = new URL(location.href);
    if (page !== "wallet") {
      url.searchParams.delete("returnDesign");
      url.searchParams.delete("finance");
      url.searchParams.delete("amount");
    }
    if (page === "home") url.searchParams.delete("page");
    else url.searchParams.set("page", page);
    if (taskId && ["detail", "assets", "assignment", "submit", "discover"].includes(page))
      url.searchParams.set("task", taskId);
    else url.searchParams.delete("task");
    if (["assignment", "submit"].includes(page))
      url.searchParams.set("assignment", assignmentId);
    else url.searchParams.delete("assignment");
    const state = { ...window.history.state, studioDepth: routeDepth.current };
    if (routeMode.current === "push") window.history.pushState(state, "", url);
    else window.history.replaceState(state, "", url);
    routeMode.current = "replace";
  }, [page, taskId, assignmentId, activeLanguage]);
  useEffect(() => {
    const onPop = () => {
      const route = readRoute();
      routeMode.current = "pop";
      routeDepth.current = Number(window.history.state?.studioDepth) || 0;
      setPage(route.page);
      setTaskId(route.taskId);
      setAssignmentId(route.assignmentId);
      setModal(null);
      setReviewer(false);
      keyboard.hide();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [keyboard]);
  const keepScreen = () => {
    if (nativeMode) keyboard.hide();
    requestAnimationFrame(() => screenRef.current?.scrollTo(0, 0));
  };
  async function flushDraft() {
    const payload = pendingDraft.current;
    if (!payload || submittedDraft.current) return true;
    try {
      const saved = await api<Assignment>(
        "/assignments/" + payload.id + "/draft",
        "PATCH",
        { links: payload.links, note: payload.note },
      );
      setData((current) =>
        current
          ? {
              ...current,
              assignments: current.assignments.map((a) =>
                a.id === saved.id ? saved : a,
              ),
            }
          : current,
      );
      setDraftState("草稿已保存");
      return true;
    } catch (e) {
      say((e as Error).message, true);
      return false;
    }
  }
  async function go(next: Page, root = false) {
    if (["reviews", "manage", "publish", "assets"].includes(next))
      next = "profile";
    if (page === "submit" && next !== "submit" && !(await flushDraft())) return;
    keyboard.hide();
    externalWalletEntry.current = false;
    routeMode.current = root ? "replace" : "push";
    routeDepth.current = root ? 0 : routeDepth.current + 1;
    setPage(next);
    setModal(null);
    setInitialError("");
  }
  async function back() {
    if (page === "submit" && !(await flushDraft())) return;
    keyboard.hide();
    if (page === "wallet") {
      const returnDesign = new URLSearchParams(location.search).get("returnDesign");
      if (returnDesign && ["newcomer", "advanced", "third"].includes(returnDesign)) {
        navigateApp("/?view=app&design=" + returnDesign);
        return;
      }
      const walletReturn = window.history.state?.walletReturnUrl;
      if (externalWalletEntry.current && typeof walletReturn === 'string' && walletReturn.startsWith('/?')) {
        navigateApp(walletReturn, true);
        return;
      }
      if (externalWalletEntry.current && routeDepth.current === 0 && document.referrer) {
        const previous = new URL(document.referrer);
        if (previous.origin === location.origin && previous.pathname === "/" &&
            (["newcomer", "advanced", "third"].includes(previous.searchParams.get("design") || "") || previous.searchParams.get("page") === "assignment")) {
          navigateApp(previous.pathname + previous.search);
          return;
        }
      }
    }
    if (routeDepth.current > 0) window.history.back();
    else go("home", true);
  }
  function open(name: string) {
    keyboard.hide();
    setModal(name);
  }
  function detail(t: Task) {
    setTaskId(t.id);
    go("detail");
  }
  function viewAssignment(a: Assignment, isReviewer = false) {
    setAssignmentId(a.id);
    setTaskId(a.task_id);
    setReviewer(isReviewer);
    setReviewChecks([false, false, false]);
    setReviewReason("");
    go("assignment");
  }
  async function perform<T>(
    fn: () => Promise<T>,
    message?: string,
  ): Promise<T | undefined> {
    setBusy(true);
    try {
      const result = await fn();
      await refresh();
      if (message) say(message);
      return result;
    } catch (e) {
      say((e as Error).message, true);
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  async function bookmark(t: Task) {
    await perform(
      () => api<Task>("/tasks/" + t.id + "/bookmark", "POST", {}),
      t.bookmarked ? "已取消收藏" : "已加入收藏",
    );
  }
  async function reload() {
    setRefreshing(true);
    try {
      await refresh();
      say("数据已更新");
    } catch (e) {
      say((e as Error).message, true);
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => {
    if (page === "manage")
      api<{ tasks: Task[] }>("/manage/tasks")
        .then((r) => setManaged(r.tasks))
        .catch((e) => say(e.message, true));
  }, [page, say]);
  useEffect(() => {
    if (page === "submit" && assignment) {
      submittedDraft.current = false;
      setLinks(
        Array.from(
          { length: assignment.task.posts },
          (_, i) => assignment.draft.links?.[i] || "",
        ),
      );
      setNote(assignment.draft.note || "");
      setSelectedUploads(assignment.uploads.map((u) => u.id));
      setDraftState(assignment.draft.savedAt ? "已保存草稿" : "草稿将自动保存");
    }
  }, [page, assignment?.id]);
  useEffect(() => {
    if (
      page === "submit" &&
      assignment &&
      !["active", "revision"].includes(assignment.status)
    ) {
      routeMode.current = "replace";
      setPage("assignment");
    }
  }, [page, assignment?.status]);
  useEffect(() => {
    pendingDraft.current =
      page === "submit" &&
      assignment &&
      ["active", "revision"].includes(assignment.status) &&
      links.length === assignment.task.posts
        ? { id: assignment.id, links, note }
        : null;
  }, [page, assignment?.id, assignment?.status, links, note]);
  useEffect(() => {
    const preserve = () => {
      const draft = pendingDraft.current;
      if (!draft || submittedDraft.current) return;
      void fetch("/api/assignments/" + draft.id + "/draft", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Workspace-Request": "1",
        },
        body: JSON.stringify({ links: draft.links, note: draft.note }),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener("pagehide", preserve);
    window.addEventListener("beforeunload", preserve);
    window.addEventListener("popstate", preserve);
    return () => {
      window.removeEventListener("pagehide", preserve);
      window.removeEventListener("beforeunload", preserve);
      window.removeEventListener("popstate", preserve);
    };
  }, []);
  useEffect(() => {
    if (
      page !== "submit" ||
      !assignment ||
      !["active", "revision"].includes(assignment.status) ||
      links.length !== assignment.task.posts
    )
      return;
    setDraftState("等待保存…");
    const timer = setTimeout(() => {
      setDraftState("保存中…");
      api<Assignment>("/assignments/" + assignment.id + "/draft", "PATCH", {
        links,
        note,
      })
        .then((saved) => {
          setData((current) =>
            current
              ? {
                  ...current,
                  assignments: current.assignments.map((a) =>
                    a.id === saved.id ? saved : a,
                  ),
                }
              : current,
          );
          setDraftState("草稿已保存");
        })
        .catch(() => setDraftState("保存失败，请手动重试"));
    }, 800);
    return () => clearTimeout(timer);
  }, [links, note, page, assignmentId]);
  async function uploadScreens(files: FileList | null) {
    if (!files || !assignment) return;
    const chosen = Array.from(files);
    if (chosen.length + assignment.uploads.length > 10) {
      say("每个任务最多保存 10 张截图", true);
      return;
    }
    setUploading(true);
    try {
      for (const file of chosen) {
        if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)
          throw new Error("请选择 5 MB 以内的图片");
        const u = await api<Upload>(
          "/assignments/" + assignment.id + "/uploads",
          "POST",
          { name: file.name, data: await fileData(file) },
        );
        setSelectedUploads((old) => [...old, u.id]);
      }
      await refresh();
      say(chosen.length + " 张截图已保存到工作区");
    } catch (e) {
      say((e as Error).message, true);
      await refresh();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  async function uploadCover(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const u = await api<Upload>("/assets", "POST", {
        name: file.name,
        data: await fileData(file),
      });
      setForm((old) => ({ ...old, cover: u.path }));
      say("封面已保存");
    } catch (e) {
      say((e as Error).message, true);
    } finally {
      setUploading(false);
      if (coverRef.current) coverRef.current.value = "";
    }
  }
  async function submit() {
    if (!assignment) return;
    const result = await perform(
      () =>
        api<Assignment>("/assignments/" + assignment.id + "/submit", "POST", {
          links,
          note,
          uploadIds: selectedUploads,
        }),
      "作品已提交，等待审核",
    );
    if (result) {
      submittedDraft.current = true;
      setReviewer(false);
      go("assignment");
    }
  }
  async function review(decision: "approve" | "changes") {
    if (!assignment) return;
    const result = await perform(
      () =>
        api<Assignment>("/assignments/" + assignment.id + "/review", "POST", {
          decision,
          reason: reviewReason,
        }),
      decision === "approve"
        ? "审核通过，资金账本已完成结算"
        : "修改意见已发送给创作者",
    );
    if (result) {
      setModal(null);
      go("reviews");
    }
  }
  async function uploadTaskMaterials(files: FileList | null) {
    if (!files || !task) return;
    const selected = Array.from(files);
    if (
      selected.some(
        (f) =>
          f.size > 50 * 1024 * 1024 || !/\.(mp4|webm|txt|srt)$/i.test(f.name),
      )
    ) {
      say("支持 50 MB 以内的 MP4、WebM 或 TXT/SRT 文案", true);
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    const total = selected.reduce((n, f) => n + f.size, 0);
    let finished = 0;
    try {
      for (const file of selected) {
        setUploadName(file.name);
        await uploadMaterial(task.id, file, (percentage) =>
          setUploadProgress(
            Math.round(
              ((finished + (file.size * percentage) / 100) / total) * 100,
            ),
          ),
        );
        finished += file.size;
      }
      await refresh();
      setManaged((await api<{ tasks: Task[] }>("/manage/tasks")).tasks);
      say(selected.length + " 份素材已保存");
    } catch (e) {
      say((e as Error).message, true);
      await refresh();
    } finally {
      setUploading(false);
      setUploadName("");
      if (materialRef.current) materialRef.current.value = "";
    }
  }
  async function updateMaterial(material: Material, restore = false) {
    const r = await perform(
      () =>
        api(
          "/materials/" + material.id + (restore ? "/restore" : ""),
          restore ? "POST" : "DELETE",
          restore ? {} : undefined,
        ),
      restore ? "素材已恢复" : "素材已归档，可在已归档中恢复",
    );
    if (r) {
      setAssetAll(
        (
          await api<{ materials: Material[] }>(
            "/tasks/" + material.task_id + "/materials?all=1",
          )
        ).materials,
      );
      setManaged((await api<{ tasks: Task[] }>("/manage/tasks")).tasks);
      setModal(null);
    }
  }
  async function publish() {
    const t = await perform(
      () => api<Task>("/tasks", "POST", form),
      "任务已发布到大厅",
    );
    if (t) {
      setForm(initialForm);
      setTaskId(t.id);
      go("detail");
    }
  }
  const onFocus = { onFocus: keepScreen, onBlur: () => keyboard.hide() };
  const textFile = (t: Task) =>
    "data:text/plain;charset=utf-8," +
    encodeURIComponent(
      `${t.title}\n\n${t.description}\n\n推荐标题：${t.title}｜新的故事，从这里开始\n推荐标签：#短剧 #${t.genre} #${t.title} #Drama\n\n发布平台：${t.platform}\n发布数量：${t.posts} 条\n语言：${t.language}\n`,
    );
  const visibleTasks = (
    (page === "saved" ? (data?.savedTasks ?? data?.tasks) : data?.tasks) || []
  )
    .filter(
      (t) =>
        (platform === "全部" || t.platform === platform) &&
        (genre === "全部题材" || t.genre === genre) &&
        (t.title + t.genre)
          .toLowerCase()
          .includes(query.trim().toLowerCase()) &&
        (page !== "saved" || t.bookmarked),
    )
    .sort((a, b) =>
      sort === "佣金最高"
        ? b.commission - a.commission
        : sort === "预付最低"
          ? a.deposit - b.deposit
          : sort === "最新上线"
            ? b.created_at.localeCompare(a.created_at)
            : Number(b.badge === "高佣推荐") - Number(a.badge === "高佣推荐"),
    );
  const assignedTasks = (data?.assignments || []).filter(
      (a) =>
        (tab === "全部" || statusText[a.status] === tab) &&
        (!taskSearch.trim() ||
          (a.task.title + " " + a.id)
            .toLowerCase()
            .includes(taskSearch.trim().toLowerCase())),
    ),
    pendingReviews = (data?.assignments || []).filter(
      (a) => a.status === "review",
    );
  const notices = data?.notifications || [],
    unread = data?.notificationsUnread??notices.filter((n) => !n.is_read).length,
    footerStyle = {
      bottom: nativeMode ? 14 : Math.max(16, insets.bottomInset),
    };
  useEffect(()=>setLedgerExpanded(false),[ledgerFilter,ledgerSearch]);
  if(assignment?.task.stage===3&&!reviewer&&['assignment','submit'].includes(page))return <DesignPreview><ThirdCopyright assignmentId={assignment.id}/></DesignPreview>;
  if(task?.stage===3&&page==='detail')return <DesignPreview><StageWork stage={3}/></DesignPreview>;
  const filteredLedger=(data?.ledger || [])
                        .filter(
                          (r) =>
                            (!ledgerSearch.trim() ||
                              customerLedgerNote(r)
                                .toLowerCase()
                                .includes(ledgerSearch.trim().toLowerCase()) ||
                              money(r.amount).includes(ledgerSearch.trim())) &&
                            (ledgerFilter === "全部" ||
                              (ledgerFilter === "活动奖励" && ["activity_reward","registration_reward","onboarding_reward"].includes(r.kind)) ||
                              (ledgerFilter === "佣金" &&
                                r.kind === "reward") ||
                              (ledgerFilter === "占用" &&
                                ["hold", "withdraw_hold"].includes(r.kind)) ||
                              (ledgerFilter === "返还" &&
                                [
                                  "release",
                                  "refund",
                                  "withdraw_refund",
                                ].includes(r.kind))),
                        );
  const pageHeader = (<>
      <header className={"s-header " + (page === "home" ? "brand-header" : "")}>
        {lx(page === "home" ? (
          <div className="s-brand">
            <span>
              <BrandMark />
            </span>
            <div>
              <BrandLockup/>

            </div>
          </div>
        ) : (
          <>
            {lx(!hasNav && (
              <button
                className="s-icon-button"
                aria-label={tx("返回")}
                onClick={back}
              >
                <ChevronLeftIcon />
              </button>
            ))}
            <div className="s-header-title">
              <h1>
                {lx(page === "assignment" && reviewer
                  ? "审核详情"
                  : pageTitles[page])}
              </h1>

            </div>
          </>
        ))}
        {lx(page === "home" ? (
          <div className="s-header-actions">
            <button
              className="s-icon-button notice"
              aria-label={
                tx("消息通知" + (unread ? "，" + unread + " 条未读" : ""))
              }
              onClick={() => go("notices")}
            >
              <NotificationIcon />
              {lx(unread > 0 && <i />)}
            </button>
          </div>
        ) : page === "saved" ? (
          <button
            className={"s-icon-button " + (showFilters ? "tinted" : "")}
            aria-label={tx("筛选与排序")}
            onClick={() => setShowFilters(!showFilters)}
          >
            <MixerHorizontalIcon />
          </button>
        ) : page === "tasks" || page === "wallet" || page === "reviews" ? (
          <div className="wallet-header-tools">{lx(page==='wallet'?<SupportContact variant="header"/>:<button
            className={"s-icon-button " + (refreshing ? "spinning" : "")}
            aria-label={tx("刷新数据")}
            onClick={reload}
          >
            <UpdateIcon />
          </button>)}</div>
        ) : page === "manage" ? (
          <button
            className="s-icon-button tinted"
            aria-label={tx("发布新任务")}
            onClick={() => go("publish")}
          >
            <PlusIcon />
          </button>
        ) : null)}
      </header>
      {lx(connectionError && data && (
        <div className="s-connection-banner" role="status">
          <ExclamationTriangleIcon />
          <span>{tx("连接已中断，当前显示上次读取的记录。")}</span>
          <button disabled={refreshing} onClick={reload}>
            {lx(refreshing ? "连接中" : "重试")}
          </button>
        </div>
      ))}
  </>);
  return (
    <div
      className={
        "studio experience-v3 page-" +
        page +
        (nativeMode ? " native-mode" : "") +
        (hasNav ? " main-navigation-page" : "") +
        (connectionError && data ? " has-connection-error" : "")
      }
    >
      {lx(!hasNav && pageHeader)}
      <MobileScroll
        className={"s-scroll " + (hasNav ? "nav-scroll" : "")}
        key={page}
      >
        {lx(hasNav && pageHeader)}
        <main
          className={
            "s-main " +
            (hasNav ? "with-nav" : "") +
            (showFooter ? " with-footer" : "")
          }
        >
          {lx(!data ? (
            <div className="s-loading">
              <div className="s-skeleton hero-skeleton" />
              <div className="s-skeleton line-skeleton" />
              <div className="s-skeleton card-skeleton" />
              {lx(initialError && (
                <div className="s-error-box">
                  <ExclamationTriangleIcon />
                  <p>{lx(initialError)}</p>
                  <Button kind="secondary" onClick={reload}>{tx("重新连接")}</Button>
                </div>
              ))}
            </div>
          ) : (
            <>
              {lx(["detail", "assets"].includes(page) &&
                !task &&
                (routeError ? (
                  <Empty
                    icon={ExclamationTriangleIcon}
                    title={tx("无法打开这项任务")}
                    description={tx(routeError)}
                  >
                    <Button onClick={() => go("hall", true)}>{tx("返回任务大厅")}</Button>
                  </Empty>
                ) : (
                  <div className="s-loading">
                    <div className="s-skeleton card-skeleton" />
                  </div>
                )))}
              {lx(["assignment", "submit"].includes(page) && !assignment && (
                <Empty
                  icon={ReaderIcon}
                  title={tx("没有找到这条任务记录")}
                  description={tx("无法读取该记录，请从我的任务重新打开。")}
                >
                  <Button onClick={() => go("tasks", true)}>{tx("查看我的任务")}</Button>
                </Empty>
              ))}
              {lx(page === "home" && (
                <>
                  <div className="v3-home-welcome"><span>{tx("你的创作空间")}</span><b>{data.profile.name}{tx("，欢迎回来")}</b></div>
                  <section className="s-hero">
                    <img src="/art/studio-access-fantasy-20261026.png" alt={tx("月光城堡与漫剧故事世界")} fetchPriority="high" />
                    <div className="s-hero-shade" />
                    <div className="s-hero-copy">
                      <span className="s-hero-eyebrow">{tx("STORIES WORTH SHARING")}</span>
                      <h1>{activeLanguage==='zh-SG'?<>让好故事<br />成为你的<span>新可能</span></>:tx("让好故事成为新可能")}</h1>
                      <p>{tx("精选漫剧 · 创作素材")}<br />{tx("用你的创作，连接更多观众")}</p>
                      <Button kind="light" onClick={() => go("hall", true)}>{tx("继续当前任务")}<ArrowRightIcon />
                      </Button>
                    </div>
                    <div className="s-hero-label">
                      <span />{tx("创作者计划 · 持续开放")}</div>
                  </section>
                  <section className="s-overview">
                    <button
                      className="s-earned"
                      onClick={() => go("wallet", true)}
                    >
                      <span>{tx("累计任务佣金")}<ArrowTopRightIcon />
                      </span>
                      <strong>{lx(money(data.wallet.earned))}</strong>
                      <small>{tx("累计已结算")}</small>
                    </button>
                    <div className="s-overview-counts">
                      <button
                        onClick={() => {
                          setTab("进行中");
                          go("tasks", true);
                        }}
                      >
                        <b>{lx(data.counts.active)}</b>
                        <span>{tx("创作中")}</span>
                      </button>
                      <button
                        onClick={() => {
                          setTab("已完成");
                          go("tasks", true);
                        }}
                      >
                        <b>{lx(data.counts.completed)}</b>
                        <span>{tx("已完成")}</span>
                      </button>
                    </div>
                  </section>
                  <StageHub compact />
                  <div className="s-shortcuts">
                    <button onClick={() => go("saved")}>
                      <span className="peach">
                        <StarIcon />
                      </span>
                      <div>
                        <b>{tx("我的收藏")}</b>
                        <small>{lx(storyFavoriteCount)}{tx(" 部心动故事")}</small>
                      </div>
                      <ChevronRightIcon />
                    </button>
                  </div>
                  <button
                    className="u-discovery-entry"
                    onClick={() => go("discover")}
                  >
                    <div>
                      <small>{tx("THE STORY THEATER")}</small>
                      <b>{tx("光影剧场")}</b>
                      <span>{tx("在海报之间，发现创作灵感")}</span>
                    </div>
                    <div className="u-discovery-posters" aria-hidden="true">
                      {lx(data.tasks.slice(0, 3).map((t) => (
                        <img key={t.id} src={t.cover} alt="" />
                      )))}
                    </div>
                    <ChevronRightIcon />
                  </button>
                  {lx(data.assignments.some((a) =>
                    ["active", "revision"].includes(a.status),
                  ) && (
                    <Section title={tx("继续你的创作")}>
                      <AssignmentCard
                        onOpen={viewAssignment}
                        a={
                          data.assignments.find((a) =>
                            ["active", "revision"].includes(a.status),
                          )!
                        }
                      />
                    </Section>
                  ))}
                </>
              ))}
              {lx(page === "discover" && (
                <DesignBoundary>
                  <Suspense
                    fallback={
                      <div className="u-inline-loading" role="status">{tx("正在布置故事的舞台…")}</div>
                    }
                  >
                    <StoryCatalog ownerId={user.id} initialTaskId={taskId} onSelect={setTaskId}/>
                  </Suspense>
                </DesignBoundary>
              ))}
              {lx(page === "help" && (
                <DesignBoundary>
                  <Suspense
                    fallback={
                      <div className="u-inline-loading" role="status">{tx("正在打开帮助中心…")}</div>
                    }
                  >
                    <HelpCenter onGo={go} />
                  </Suspense>
                </DesignBoundary>
              ))}
              {lx(page === "hall" && <StageHub />)}
              {lx(page === "saved" && (
                <>
                  <DesignBoundary><Suspense fallback={<div className="u-inline-loading">{tx("正在读取收藏故事…")}</div>}><StoryCatalog ownerId={user.id} savedOnly/></Suspense></DesignBoundary>
                  {lx(data.bookmarks.length>0&&<details className="sc-legacy"><summary>{tx("历史剧集收藏 · ")}{lx(data.bookmarks.length)}{tx(" 部")}</summary>
                  <div className="u-library-intro">
                    <span>{tx("THE STORY LIBRARY")}</span>
                    <h2>
                      {lx(page === "saved"
                        ? "收藏你心动的故事"
                        : "发现值得创作的故事")}
                    </h2>
                    <p>
                      {lx(page === "saved"
                        ? "留下灵感，随时回来继续创作。"
                        : "按平台和题材找到适合你风格的剧集。")}
                    </p>
                  </div>
                  <div className="s-search">
                    <MagnifyingGlassIcon />
                    <KeyboardInput
                      {...onFocus}
                      placeholder={tx("搜索剧集、题材或故事")}
                      aria-label={tx("搜索剧集")}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {lx(query && (
                      <button
                        aria-label={tx("清空搜索")}
                        onClick={() => setQuery("")}
                      >
                        <Cross2Icon />
                      </button>
                    ))}
                  </div>
                  <div className="s-platform-tabs">
                    {lx(["全部", "TikTok", "YouTube", "Facebook"].map((p) => (
                      <button
                        aria-pressed={platform === p}
                        className={platform === p ? "active" : ""}
                        onClick={() => setPlatform(p)}
                        key={p}
                      >
                        {lx(p)}
                      </button>
                    )))}
                  </div>
                  <Carousel
                    ariaLabel={tx('剧集题材')}
                    contentClassName="u-genre-track"
                  >
                    {lx([
                      "全部题材",
                      ...new Set(data.tasks.map((t) => t.genre)),
                    ].map((item) => (
                      <button
                        key={item}
                        aria-pressed={genre === item}
                        onClick={() => setGenre(item)}
                      >
                        {lx(item === "全部题材" ? "全部题材" : item)}
                      </button>
                    )))}
                  </Carousel>
                  {lx(showFilters && (
                    <div className="s-filter-panel">
                      <label>{tx("排序")}<select
                          value={sort}
                          onChange={(e) => setSort(e.target.value)}
                        >
                          {lx(["推荐", "佣金最高", "预付最低", "最新上线"].map(
                            (x) => (
                              <option key={x}>{lx(x)}</option>
                            ),
                          ))}
                        </select>
                      </label>
                      <label>{tx("题材")}<select
                          value={genre}
                          onChange={(e) => setGenre(e.target.value)}
                        >
                          {lx([
                            "全部题材",
                            ...new Set(data.tasks.map((t) => t.genre)),
                          ].map((x) => (
                            <option key={x}>{lx(x)}</option>
                          )))}
                        </select>
                      </label>
                      <button
                        onClick={() => {
                          setGenre("全部题材");
                          setSort("推荐");
                          setPlatform("全部");
                          setQuery("");
                        }}
                      >{tx("重置")}</button>
                    </div>
                  ))}
                  <div className="s-list-meta">
                    <span>
                      {lx(page === "saved" ? "已收藏" : "为你找到")}{lx(" ")}
                      <b>{lx(visibleTasks.length)}</b>{tx("部剧集")}</span>
                    <button
                      onClick={() =>
                        setSort(sort === "佣金最高" ? "推荐" : "佣金最高")
                      }
                    >
                      {lx(sort === "佣金最高" ? "按佣金排序" : "精选推荐")}{lx(" ")}
                      <ChevronRightIcon />
                    </button>
                  </div>
                  {lx(visibleTasks.length ? (
                    visibleTasks.map((t) => (
                      <TaskCard
                        onDetail={detail}
                        onBookmark={bookmark}
                        busy={busy}
                        t={t}
                        key={t.id}
                      />
                    ))
                  ) : (
                    <Empty
                      icon={page === "saved" ? StarIcon : MagnifyingGlassIcon}
                      title={
                        tx(page === "saved"
                          ? data.bookmarks.length
                            ? "当前筛选下没有收藏剧集"
                            : "把喜欢的故事留在这里"
                          : "没有找到相关剧集")
                      }
                      description={
                        tx(page === "saved"
                          ? data.bookmarks.length
                            ? "试试清空关键词或切换平台、题材。"
                            : "在剧场或剧集详情点击星标，即可随时回来查看。"
                          : "换一个关键词，或试试其他平台。")
                      }
                    >
                      <Button
                        kind="secondary"
                        onClick={() => {
                          setQuery("");
                          setPlatform("全部");
                          setGenre("全部题材");
                          if (page === "saved" && !data.bookmarks.length)
                            go("discover", true);
                        }}
                      >
                        {lx(page === "saved" && !data.bookmarks.length
                          ? "发现更多剧集"
                          : "重置筛选")}
                      </Button>
                    </Empty>
                  ))}
                  </details>)}
                </>
              ))}
              {lx(page === "detail" && task && (
                <>
                  <section className="s-detail-art">
                    <img src={task.cover} alt={tx(task.title)} />
                    <div />
                    <span className="s-detail-badge">
                      {lx(task.badge || "精选剧集")}
                    </span>
                    <div className="s-detail-heading">
                      <span>
                        {lx(task.genre)} · {lx(task.episodes)}{tx(" 集 · ")}{lx(task.language)}
                      </span>
                      <h1>{lx(task.title)}</h1>
                      <Platform name={task.platform} />
                    </div>
                    <button
                      className={
                        "s-detail-save " + (task.bookmarked ? "saved" : "")
                      }
                      onClick={() => bookmark(task)}
                      aria-label={tx(task.bookmarked ? "取消收藏" : "收藏剧集")}
                    >
                      {lx(task.bookmarked ? <StarFilledIcon /> : <StarIcon />)}
                    </button>
                  </section>
                  <div className="s-detail-prices">
                    <div>
                      <span>{tx("任务佣金")}</span>
                      <strong>{lx(money(task.commission))}</strong>
                    </div>
                    <div>
                      <span>{tx("预付额度")}</span>
                      <b>{lx(money(task.deposit))}</b>
                    </div>
                    <div>
                      <span>{tx("完成期限")}</span>
                      <b>
                        48 <small>{tx("小时")}</small>
                      </b>
                    </div>
                  </div>
                  <p className="s-synopsis">{lx(task.description)}</p>
                  <Section title={tx("任务说明")}>
                    <div className="s-fact-grid">
                      <div>
                        <VideoIcon />
                        <span>{tx("发布数量")}<b>{lx(task.posts)}{tx(" 条视频")}</b>
                        </span>
                      </div>
                      <div>
                        <ClockIcon />
                        <span>{tx("完成期限")}<b>{tx("48 小时内")}</b>
                        </span>
                      </div>
                      <div>
                        <DashboardIcon />
                        <span>{tx("发布平台")}<b>{lx(task.platform)}</b>
                        </span>
                      </div>
                      <div>
                        <PersonIcon />
                        <span>{tx("领取名额")}<b>{tx("不限")}</b>
                        </span>
                      </div>
                    </div>
                  </Section>
                  <Section title={tx("创作要求")}>
                    <ol className="s-requirements">
                      <li>{tx("使用授权素材，在")}{lx(task.platform)}{tx(" 发布 ")}{lx(task.posts)}{lx(" ")}{tx("条完整视频。")}</li>
                      <li>{tx("作品需保持公开至少 30 天，遵守平台内容规范。")}</li>
                      <li>{tx("使用提供的推广标题与标签，可适当剪辑并加入个人表达。")}</li>
                      <li>{tx("提交不同的视频链接，以及清晰的发布成功截图。")}</li>
                    </ol>
                  </Section>
                  <Section
                    title={tx("可用素材")}
                    action={
                      <span className="s-subtle">{tx("领取后也可随时查看")}</span>
                    }
                  >
                    <div className="s-materials">
                      <a href={task.cover} download={task.title + "-封面.png"}>
                        <span className="peach">
                          <ImageIcon />
                        </span>
                        <b>{tx("封面图片")}</b>
                        <small>{tx("可下载")}</small>
                        <DownloadIcon />
                      </a>
                      <a
                        href={textFile(task)}
                        download={task.title + "-文案.txt"}
                      >
                        <span className="lavender">
                          <FileTextIcon />
                        </span>
                        <b>{tx("推广文案")}</b>
                        <small>{tx("TXT · 标题与标签")}</small>
                        <DownloadIcon />
                      </a>
                    </div>
                    {lx((task.materials || [])
                      .filter((m) => m.kind === "video")
                      .map((m) => (
                        <div className="s-video-material" key={m.id}>
                          <video
                            controls
                            playsInline
                            preload="metadata"
                            src={m.path}
                            poster={task.cover}
                            data-scroll-drag="ignore"
                          />
                          <div>
                            <span>
                              <b>{lx(m.name)}</b>
                              <small>{lx(fileSize(m.size))}</small>
                            </span>
                            <a href={m.path} download={m.name}>
                              <DownloadIcon />{tx("下载")}</a>
                          </div>
                        </div>
                      )))}
                    {lx((task.materials || [])
                      .filter((m) => m.kind === "document")
                      .map((m) => (
                        <a
                          className="s-document-material"
                          key={m.id}
                          href={m.path}
                          download={m.name}
                        >
                          <FileTextIcon />
                          <span>
                            <b>{lx(m.name)}</b>
                            <small>{lx(fileSize(m.size))}{tx(" · 文案素材")}</small>
                          </span>
                          <DownloadIcon />
                        </a>
                      )))}
                    {lx(!(task.materials || []).some(
                      (m) => m.kind === "video",
                    ) && (
                      <div className="s-info-note">
                        <VideoIcon />
                        <span>{tx("当前剧集尚未提供视频素材，请等待平台更新。")}</span>
                      </div>
                    ))}
                  </Section>
                  <button className="s-rule-link" onClick={() => open("rules")}>{tx("查看费用与结算说明")}<ChevronRightIcon />
                  </button>
                </>
              ))}
              {lx(page === "tasks" && (
                <>
                  <section className="u-task-overview">
                    <div>
                      <span>{tx("YOUR CREATIVE JOURNEY")}</span>
                      <h2>{tx("每一次完成，都值得记录")}</h2>
                    </div>
                    <div className="u-task-counts">
                      {lx([
                        {
                          label: "创作中",
                          tab: "进行中",
                          value: data.counts.active,
                        },
                        {
                          label: "审核中",
                          tab: "审核中",
                          value: data.counts.review,
                        },
                        {
                          label: "已完成",
                          tab: "已完成",
                          value: data.counts.completed,
                        },
                      ].map((item) => (
                        <button
                          key={item.label}
                          onClick={() => setTab(item.tab)}
                        >
                          <strong>{lx(item.value)}</strong>
                          <span>{lx(item.label)}</span>
                        </button>
                      )))}
                    </div>
                  </section>
                  <div className="v3-record-heading"><h3>{tx("作品记录")}</h3><span>{lx(data.assignments.length)}{tx(" 条记录")}</span></div>
                  <div className="u-ledger-search u-task-search">
                    <MagnifyingGlassIcon />
                    <KeyboardInput
                      {...onFocus}
                      aria-label={tx("搜索我的任务")}
                      value={taskSearch}
                      onChange={(e) => setTaskSearch(e.target.value)}
                      placeholder={tx("搜索任务名称或编号")}
                    />
                    {lx(taskSearch && (
                      <button
                        aria-label={tx("清空任务搜索")}
                        onClick={() => setTaskSearch("")}
                      >
                        <Cross2Icon />
                      </button>
                    ))}
                  </div>
                  <Carousel
                    ariaLabel={tx('任务状态')}
                    contentClassName="s-status-track"
                  >
                    {lx(tabs.map((t) => (
                      <button
                        aria-pressed={tab === t}
                        className={tab === t ? "active" : ""}
                        onClick={() => setTab(t)}
                        key={t}
                      >
                        {lx(t)}
                        <span>
                          {lx(t === "全部"
                            ? data.assignments.length
                            : data.assignments.filter(
                                (a) => statusText[a.status] === t,
                              ).length)}
                        </span>
                      </button>
                    )))}
                  </Carousel>
                  {lx(assignedTasks.length ? (
                    assignedTasks.map((a) => (
                      <AssignmentCard
                        onOpen={viewAssignment}
                        a={a}
                        key={a.id}
                      />
                    ))
                  ) : (
                    <Empty
                      title={
                        tx(taskSearch
                          ? "没有匹配的创作记录"
                          : tab === "全部"
                            ? "还没有作品记录"
                            : "暂无" + tab + "任务")
                      }
                      description={
                        tx(taskSearch
                          ? "换一个任务名称或编号，或者清空搜索。"
                          : "购买过的作品与结算记录会显示在这里。")
                      }
                    >
                      <Button
                        onClick={() =>
                          taskSearch ? setTaskSearch("") : go("hall", true)
                        }
                      >
                        {lx(taskSearch ? "清空搜索" : "前往任务")}{lx(" ")}
                        <ArrowRightIcon />
                      </Button>
                    </Empty>
                  ))}
                </>
              ))}
              {lx(page === "assignment" && assignment && (
                <>
                  <div className={"s-assignment-banner " + assignment.status}>
                    <span>
                      {lx(assignment.status === "completed" ? (
                        <CheckCircledIcon />
                      ) : assignment.status === "revision" ? (
                        <ExclamationTriangleIcon />
                      ) : assignment.status === "review" ? (
                        <ClockIcon />
                      ) : (
                        <VideoIcon />
                      ))}
                    </span>
                    <div>
                      <h2>
                        {lx(assignment.status === "completed"
                          ? "这份创作，已完成结算"
                          : assignment.status === "review"
                            ? "作品已提交，等待审核"
                            : assignment.status === "revision"
                              ? "还有一点，可以更好"
                              : "你的下一份好作品，从这里开始")}
                      </h2>
                      <p>
                        {lx(assignment.status === "completed"
                          ? "预付额度已返还，佣金已记入账本"
                          : assignment.status === "review"
                            ? "提交的链接、截图与时间记录已保存"
                            : assignment.status === "revision"
                              ? assignment.review_note
                              : "请在 " +
                                date(assignment.deadline) +
                                " 前提交作品")}
                      </p>
                    </div>
                  </div>
                  <div className="s-assignment-title">
                    <img src={assignment.task.cover} alt="" />
                    <div>
                      <h2>{lx(assignment.task.title)}</h2>
                      <Platform name={assignment.task.platform} />
                      <span>{tx("任务编号")}{lx(assignment.id.slice(0, 8).toUpperCase())}
                      </span>
                    </div>
                  </div>
                  <div className="s-money-pair">
                    <div>
                      <span>{tx("预付额度")}</span>
                      <strong>{lx(money(assignment.task.deposit))}</strong>
                    </div>
                    <div>
                      <span>{tx("任务佣金")}</span>
                      <strong>{lx(money(assignment.task.commission))}</strong>
                    </div>
                  </div>
                  <div className="s-progress-steps">
                    {lx(["领取任务", "上传截图", "提交审核", "完成结算"].map(
                      (label, i) => {
                        const done =
                          i === 0 ||
                          (i === 1 &&
                            assignment.uploads.length >=
                              assignment.task.posts) ||
                          (i === 2 && assignment.submissions.length > 0) ||
                          (i === 3 && assignment.status === "completed");
                        return (
                          <div className={done ? "done" : ""} key={label}>
                            <span>{lx(done ? <CheckIcon /> : i + 1)}</span>
                            <small>{lx(label)}</small>
                          </div>
                        );
                      },
                    ))}
                  </div>
                  {lx(assignment.status === "revision" && (
                    <div className="s-feedback">
                      <ExclamationTriangleIcon />
                      <div>
                        <b>{tx("审核意见")}</b>
                        <p>{lx(assignment.review_note)}</p>
                      </div>
                    </div>
                  ))}
                  <Section title={tx("任务信息")}>
                    <dl className="s-definition">
                      <dt>{tx("领取时间")}</dt>
                      <dd>{lx(date(assignment.created_at, true))}</dd>
                      <dt>{tx("截止时间")}</dt>
                      <dd>{lx(date(assignment.deadline, true))}</dd>
                      <dt>{tx("发布数量")}</dt>
                      <dd>{lx(assignment.task.posts)}{tx(" 条")}</dd>
                      <dt>{tx("当前状态")}</dt>
                      <dd>
                        <span className={"s-status " + assignment.status}>
                          {lx(statusText[assignment.status])}
                        </span>
                      </dd>
                    </dl>
                  </Section>
                  {lx(assignment.submissions.length > 0 && (
                    <Section
                      title={tx("已提交的作品")}
                      action={
                        <button
                          className="s-text-button"
                          onClick={() => open("history")}
                        >{tx("提交历史（")}{lx(assignment.submissions.length)}{tx("版）")}<ChevronRightIcon />
                        </button>
                      }
                    >
                      <div className="s-submission-links">
                        {lx(assignment.submissions[0].links.map((link, i) => (
                          <a
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            key={link}
                          >
                            <span>{lx(i + 1)}</span>
                            <div>
                              <b>{tx("视频链接 ")}{lx(i + 1)}</b>
                              <small>{lx(link)}</small>
                            </div>
                            <ExternalLinkIcon />
                          </a>
                        )))}
                      </div>
                      <div className="s-proof-grid">
                        {lx(assignment.submissions[0].uploads.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => {
                              setPreview({ src: u.path, name: u.name });
                              open("preview");
                            }}
                          >
                            <img src={u.path} alt={tx(u.name)} />
                          </button>
                        )))}
                      </div>
                      {lx(assignment.submissions[0].note && (
                        <p className="s-submission-note">{tx("创作备注：")}{lx(assignment.submissions[0].note)}
                        </p>
                      ))}
                    </Section>
                  ))}
                  <Section title={tx("进度记录")}>
                    <ol className="s-timeline">
                      {lx(assignment.events
                        .slice()
                        .reverse()
                        .map((e) => (
                          <li key={e.id}>
                            <span />
                            <div>
                              <b>{lx(e.description)}</b>
                              <small>{lx(date(e.created_at, true))}</small>
                            </div>
                          </li>
                        )))}
                    </ol>
                  </Section>
                  {lx(reviewer && assignment.status === "review" && (
                    <div className="s-review-actions">
                      <Button kind="secondary" onClick={() => open("changes")}>{tx("退回修改")}</Button>
                      <Button onClick={() => open("approve")}>{tx("通过审核")}<CheckIcon />
                      </Button>
                    </div>
                  ))}
                  {lx(["active", "revision"].includes(assignment.status) && (
                    <button
                      className="s-cancel-link"
                      onClick={() => open("cancel")}
                    >{tx("取消任务并返还任务本金")}</button>
                  ))}
                </>
              ))}
              {lx(page === "submit" && assignment && (
                <>
                  <div className="s-submit-summary">
                    <img src={assignment.task.cover} alt="" />
                    <div>
                      <b>{lx(assignment.task.title)}</b>
                      <p>
                        {lx(assignment.task.posts)}{tx(" 条视频 ·")}{lx(" ")}
                        {lx(timeLeft(assignment.deadline))}{tx("内截止")}</p>
                    </div>
                    <span className={"s-status " + assignment.status}>
                      {lx(statusText[assignment.status])}
                    </span>
                  </div>
                  <Section
                    title={tx("发布截图")}
                    action={
                      <span className="s-subtle">{tx("已选")}{lx(selectedUploads.length)}/{lx(assignment.task.posts)}{tx("张")}</span>
                    }
                  >
                    <p className="s-field-help">{tx("上传包含账号、视频和发布状态的清晰截图。支持 PNG、JPG、WebP，每张不超过 5 MB。")}</p>
                    <div className="s-upload-grid">
                      {lx(assignment.uploads.map((u) => {
                        const locked = assignment.submissions.some((s) =>
                          s.uploads.some((x) => x.id === u.id),
                        );
                        return (
                          <div
                            className={
                              "s-upload-tile " +
                              (selectedUploads.includes(u.id) ? "selected" : "")
                            }
                            key={u.id}
                          >
                            <button
                              className="s-upload-preview"
                              aria-label={tx("预览 " + u.name)}
                              onClick={() => {
                                setPreview({ src: u.path, name: u.name });
                                open("preview");
                              }}
                            >
                              <img src={u.path} alt={tx(u.name)} />
                            </button>
                            <button
                              className="s-proof-select"
                              aria-label={
                                tx((selectedUploads.includes(u.id)
                                  ? "取消选择"
                                  : "选择") + u.name)
                              }
                              onClick={() =>
                                setSelectedUploads((old) =>
                                  old.includes(u.id)
                                    ? old.filter((x) => x !== u.id)
                                    : [...old, u.id],
                                )
                              }
                            >
                              {lx(selectedUploads.includes(u.id) ? (
                                <CheckIcon />
                              ) : (
                                <PlusIcon />
                              ))}
                            </button>
                            {lx(!locked && (
                              <button
                                className="s-proof-delete"
                                aria-label={tx("删除 " + u.name)}
                                onClick={async () => {
                                  await perform(() =>
                                    api("/uploads/" + u.id, "DELETE"),
                                  );
                                  setSelectedUploads((old) =>
                                    old.filter((id) => id !== u.id),
                                  );
                                }}
                              >
                                <TrashIcon />
                              </button>
                            ))}
                          </div>
                        );
                      }))}
                      {lx(assignment.uploads.length < 10 && (
                        <button
                          className="s-upload-add"
                          disabled={uploading}
                          onClick={() => {
                            keyboard.hide();
                            fileRef.current?.click();
                          }}
                        >
                          <UploadIcon />
                          <b>{lx(uploading ? "保存中…" : "添加截图")}</b>
                          <small>{tx("最多 10 张")}</small>
                        </button>
                      ))}
                    </div>
                    <input
                      className="s-file-input"
                      ref={fileRef}
                      type="file"
                      multiple
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(e) => uploadScreens(e.target.files)}
                      aria-label={tx("选择发布截图")}
                    />
                  </Section>
                  <Section
                    title={tx("视频链接")}
                    action={
                      <span className="s-subtle">
                        {lx(links.filter(Boolean).length)}/{lx(assignment.task.posts)}
                      </span>
                    }
                  >
                    <div className="s-input-list">
                      {lx(links.map((value, i) => (
                        <label className="s-field" key={i}>
                          <span>
                            <i>{lx(i + 1)}</i>{tx(" 视频链接 ")}{lx(i + 1)}
                          </span>
                          <KeyboardInput
                            {...onFocus}
                            type="url"
                            placeholder={tx("https://www.tiktok.com/@you/video/...")}
                            value={value}
                            onChange={(e) =>
                              setLinks((old) =>
                                old.map((x, n) =>
                                  n === i ? e.target.value : x,
                                ),
                              )
                            }
                          />
                        </label>
                      )))}
                    </div>
                  </Section>
                  <Section
                    title={tx("创作备注")}
                    action={<span className="s-subtle">{tx("选填")}</span>}
                  >
                    <KeyboardTextarea
                      {...onFocus}
                      className="s-textarea"
                      placeholder={tx("补充账号、创作说明，或本次修改的内容…")}
                      aria-label={tx("创作备注")}
                      maxLength={2000}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </Section>
                  <div className="s-draft-state">
                    <LockClosedIcon />
                    {lx(draftState)}
                    <button
                      onClick={() =>
                        perform(
                          () =>
                            api(
                              "/assignments/" + assignment.id + "/draft",
                              "PATCH",
                              { links, note },
                            ),
                          "草稿已保存",
                        )
                      }
                    >{tx("立即保存")}</button>
                  </div>
                </>
              ))}
              {lx(page === "wallet" && (
                <>
                  <FinancePanel onChange={refresh} />
                  <Section
                    title={tx("交易记录")}
                    action={
                      <span className="s-subtle">{lx(data.ledger.length)}{tx(" 笔")}</span>
                    }
                  >
                    <div className="u-ledger-search">
                      <MagnifyingGlassIcon />
                      <KeyboardInput
                        {...onFocus}
                        value={ledgerSearch}
                        onChange={(e) => setLedgerSearch(e.target.value)}
                        placeholder={tx("搜索流水备注或金额")}
                        aria-label={tx("搜索交易记录")}
                      />
                      {lx(ledgerSearch && (
                        <button
                          aria-label={tx("清空交易搜索")}
                          onClick={() => setLedgerSearch("")}
                        >
                          <Cross2Icon />
                        </button>
                      ))}
                    </div>
                    <div className="s-ledger-tabs">
                      {lx(["全部", "活动奖励", "佣金", "占用", "返还"].map((x) => (
                        <button
                          className={ledgerFilter === x ? "active" : ""}
                          onClick={() => setLedgerFilter(x)}
                          key={x}
                        >
                          {lx(x)}
                        </button>
                      )))}
                    </div>
                    <div className="s-ledger-list">
                      {lx(filteredLedger.slice(0,ledgerExpanded?undefined:5).map((r) => (
                          <div
                            className="s-ledger-row"
                            key={r.id}
                          >
                            <span className={"s-ledger-icon " + r.kind}>
                              {lx(["reward", "activity_reward","registration_reward","onboarding_reward"].includes(r.kind) ? (
                                <StarIcon />
                              ) : r.kind === "hold" ? (
                                <LockClosedIcon />
                              ) : r.kind === "credit" ? (
                                <PlusIcon />
                              ) : (
                                <ArrowTopRightIcon />
                              ))}
                            </span>
                            <span className="s-ledger-copy">
                              <b>{lx(customerLedgerNote(r))}</b>
                              <small>{lx(date(r.created_at, true))}</small>
                            </span>
                            <span
                              className={
                                "s-ledger-amount " +
                                (r.amount > 0 ? "positive" : "")
                              }
                            >
                              <b>
                                {lx(r.amount > 0 ? "+" : "")}
                                {lx(money(r.amount))}
                              </b>
                              <small>{tx("余额 ")}{lx(money(r.balance_after))}</small>
                            </span>
                          </div>
                        )))}
                    </div>
                    {lx(filteredLedger.length>5&&<button className="account-show-more" aria-expanded={ledgerExpanded} onClick={()=>setLedgerExpanded(v=>!v)}>{lx(ledgerExpanded?'收起记录':'展开更多记录 · '+filteredLedger.length+' 笔')}</button>)}
                    {lx(filteredLedger.length === 0 && (
                      <Empty
                        title={
                          tx(ledgerSearch ? "没有匹配的交易" : "还没有这类交易")
                        }
                        description={
                          tx(ledgerSearch
                            ? "试试其他备注或金额，或清空搜索。"
                            : "奖励发放或资金申请产生变动后，可在这里查看对应流水。")
                        }
                      />
                    ))}
                  </Section>
                </>
              ))}
              {lx(page === "profile" && (
                <>
                  <div className="profile-summary"><div className="profile-art-banner"><img src="/art/profile-creator-films-r15.png" alt="" /></div><section className="s-profile-card">
                    <h2>{data.profile.name}</h2>
                    <span className="profile-login-caption">{tx("登录账号 · ")}{user.email}</span>
                    <ProfileAccountId id={user.id}/>
                    <button
                      onClick={() => {
                        setProfileForm({
                          name: data.profile.name,
                          bio: data.profile.bio,
                          channel: data.profile.channel,
                        });
                        open("profile");
                      }}
                    >
                      <Pencil1Icon />{tx("修改昵称")}</button>
                  </section>
                  </div>
                  <SupportContact variant="profile"/>
                  <LanguageSelector/><AccountSecurity email={user.email}/>
                  <AccountReadiness onWallet={()=>go("wallet")}/>
                  <div className="v3-record-heading"><h3>{tx("账号服务")}</h3></div>
                  <div className="s-menu-group">
                    <button onClick={() => go("saved")}>
                      <StarIcon />
                      <span>{tx("我的收藏")}</span>
                      <small>{lx(storyFavoriteCount)}{tx(" 部")}</small>
                      <ChevronRightIcon />
                    </button>
                    <button onClick={() => go("notices")}>
                      <NotificationIcon />
                      <span>{tx("消息通知")}</span>
                      {lx(unread > 0 && (
                        <small className="s-counter">{lx(unread)}</small>
                      ))}
                      <ChevronRightIcon />
                    </button>
                  
                    <button onClick={() => go("hall", true)}><StarIcon/><span>{tx("我的成长计划")}</span><ChevronRightIcon/></button>
                  
                    <button onClick={() => go("help")}>
                      <FileTextIcon />
                      <span>{tx("帮助与服务")}</span>
                      <small>{tx("说明与连接检查")}</small>
                      <ChevronRightIcon />
                    </button>
                  
                    <button onClick={() => open("install")}>
                      <MobileIcon />
                      <span>{tx("添加到主屏幕")}</span>
                      <small>
                        {lx(serviceWorkerReady ? "界面缓存已就绪" : "全屏应用体验")}
                      </small>
                      <ChevronRightIcon />
                    </button>
                  </div>
                  <div className="s-menu-group">
                    <button
                      disabled={busy}
                      onClick={() => {
                        void logout().catch((e) => say(e.message, true));
                      }}
                    >
                      <LockClosedIcon />
                      <span>{tx("退出当前账号")}</span>
                      <ChevronRightIcon />
                    </button>
                  </div>
                  <div className="s-profile-footer">
                    <b>{tx("STORIES. CREATE. CONNECT.")}</b>
                    <span>{tx("AI CREATOR · 创作者平台")}</span>
                  </div>
                </>
              ))}
              {lx(page === "notices" && <Notifications onCountChange={count=>setData(old=>old?{...old,notificationsUnread:count}:old)} onOpen={n=>{
                if(n.category==='finance'){go('wallet');return;}
                if(n.category==='stage'){location.assign(n.record_id?.startsWith('newcomer-cover:')?'/?view=app&design=newcomer':'/?view=app&design=third');return;}
                if(n.assignment_id){const a=data.assignments.find(a=>a.id===n.assignment_id);if(a){viewAssignment(a);return;}}
                if(n.task_id){setTaskId(n.task_id);go('detail');return;}
                open('guide');
              }}/>)}
              {lx(page === "reviews" && (
                <>
                  <div className="s-workbench-heading">
                    <span className="s-workbench-icon">
                      <CheckCircledIcon />
                    </span>
                    <div>
                      <h2>{tx("认真对待每一份创作")}</h2>
                      <p>{tx("核对视频链接与截图，再给出明确的反馈。")}</p>
                    </div>
                  </div>
                  <div className="s-workbench-stats">
                    <b>{lx(pendingReviews.length)}</b>
                    <span>{tx("份作品等待审核")}</span>
                    <small>{tx("运营审核中心")}</small>
                  </div>
                  {lx(pendingReviews.length ? (
                    pendingReviews.map((a) => (
                      <button
                        className="s-review-card"
                        key={a.id}
                        onClick={() => viewAssignment(a, true)}
                      >
                        <img src={a.task.cover} alt="" />
                        <div>
                          <h3>{lx(a.task.title)}</h3>
                          <p>{tx("第")}{lx(a.submissions[0]?.version)}{tx(" 次提交 ·")}{lx(" ")}
                            {lx(a.task.posts)}{tx("条视频")}</p>
                          <small>
                            {lx(date(a.submitted_at || a.created_at, true))}
                          </small>
                        </div>
                        <ChevronRightIcon />
                      </button>
                    ))
                  ) : (
                    <Empty
                      icon={CheckCircledIcon}
                      title={tx("审核队列已清空")}
                      description={tx("创作者提交的作品会自动进入这里。审核通过后，系统会完成资金账本结算。")}
                    >
                      <Button
                        kind="secondary"
                        onClick={() => go("tasks", true)}
                      >{tx("查看我的任务")}</Button>
                    </Empty>
                  ))}
                </>
              ))}
              {lx(page === "manage" && (
                <>
                  <div className="s-management-note">
                    <DashboardIcon />
                    <div>
                      <b>{tx("管理你的剧集任务")}</b>
                      <p>{tx("发布后会显示在剧场片库，暂停后不影响已有任务。")}</p>
                    </div>
                  </div>
                  {lx(managed.map((t) => (
                    <article className="s-manage-card" key={t.id}>
                      <img src={t.cover} alt="" />
                      <div>
                        <h3>{lx(t.title)}</h3>
                        <p>
                          {lx(t.platform)} · {lx(t.posts)}{tx("条视频")}</p>
                        <small>{tx("佣金 ")}{lx(money(t.commission))}</small>
                      </div>
                      <button
                        className={"s-toggle " + (t.active ? "on" : "")}
                        role="switch"
                        aria-checked={!!t.active}
                        aria-label={tx((t.active ? "暂停" : "上架") + t.title)}
                        onClick={async () => {
                          const updated = await perform(
                            () =>
                              api<Task>("/tasks/" + t.id + "/active", "PATCH", {
                                active: !t.active,
                              }),
                            t.active ? "任务已暂停" : "任务已上架",
                          );
                          if (updated)
                            setManaged((old) =>
                              old.map((x) => (x.id === t.id ? updated : x)),
                            );
                        }}
                      >
                        <span />
                      </button>
                      <button
                        className="s-manage-materials"
                        onClick={() => {
                          setTaskId(t.id);
                          setAssetView("active");
                          go("assets");
                        }}
                      >
                        <VideoIcon />{tx("素材管理")}<small>{lx((t.materials || []).length)}{tx(" 份")}</small>
                        <ChevronRightIcon />
                      </button>
                    </article>
                  )))}
                  <Button kind="secondary" onClick={() => go("publish")}>
                    <PlusIcon />{tx("发布新任务")}</Button>
                </>
              ))}
              {lx(page === "assets" && task && (
                <>
                  <div className="s-assets-hero">
                    <img src={task.cover} alt="" />
                    <div>
                      <h2>{lx(task.title)}</h2>
                      <p>{tx("让每一份素材，成为好创作的起点。")}</p>
                      <Platform name={task.platform} />
                    </div>
                  </div>
                  <div className="s-material-uploader">
                    <VideoIcon />
                    <h3>{tx("上传视频与创作文案")}</h3>
                    <p>{tx("支持 MP4、WebM、UTF-8 TXT/SRT。")}<br />{tx("单个视频不超过 50 MB，文案不超过 2 MB。")}</p>
                    <Button
                      disabled={uploading}
                      onClick={() => {
                        keyboard.hide();
                        materialRef.current?.click();
                      }}
                    >
                      <UploadIcon />
                      {lx(uploading ? "正在保存素材…" : "选择素材文件")}
                    </Button>
                    <input
                      ref={materialRef}
                      type="file"
                      className="s-file-input"
                      multiple
                      accept="video/mp4,video/webm,.txt,.srt"
                      aria-label={tx("选择任务素材")}
                      onChange={(e) => uploadTaskMaterials(e.target.files)}
                    />
                    {lx(uploading && (
                      <div className="s-upload-progress">
                        <span>{lx(uploadName)}</span>
                        <progress value={uploadProgress} max={100} />
                        <small>{lx(uploadProgress)}%</small>
                      </div>
                    ))}
                  </div>
                  <div className="s-platform-tabs s-asset-tabs">
                    {lx([
                      ["active", "可用素材"],
                      ["archived", "已归档"],
                    ].map(([value, label]) => (
                      <button
                        aria-pressed={assetView === value}
                        className={assetView === value ? "active" : ""}
                        onClick={() => setAssetView(value)}
                        key={value}
                      >
                        {lx(label)}{lx(" ")}
                        {
                          lx(assetAll.filter((m) =>
                            value === "active" ? m.active : !m.active,
                          ).length)
                        }
                      </button>
                    )))}
                  </div>
                  {lx(assetAll
                    .filter((m) =>
                      assetView === "active" ? m.active : !m.active,
                    )
                    .map((m) => (
                      <article className="s-asset-card" key={m.id}>
                        <span>
                          {lx(m.kind === "video" ? (
                            <VideoIcon />
                          ) : (
                            <FileTextIcon />
                          ))}
                        </span>
                        <div>
                          <h3>{lx(m.name)}</h3>
                          <p>
                            {lx(fileSize(m.size))} · {lx(date(m.created_at))}
                          </p>
                          <div className="s-asset-actions">
                            {lx(m.kind === "video" && (
                              <button
                                onClick={() => {
                                  setVideoPreview(m);
                                  open("video");
                                }}
                              >{tx("预览播放")}</button>
                            ))}
                            <a href={m.path} download={m.name}>{tx("下载")}</a>
                            {lx(m.active ? (
                              <button
                                onClick={() => {
                                  setArchiveTarget(m);
                                  open("archive-material");
                                }}
                              >{tx("归档")}</button>
                            ) : (
                              <button
                                disabled={busy}
                                onClick={() => updateMaterial(m, true)}
                              >{tx("恢复素材")}</button>
                            ))}
                          </div>
                        </div>
                      </article>
                    )))}
                  {lx(!assetAll.some((m) =>
                    assetView === "active" ? m.active : !m.active,
                  ) && (
                    <Empty
                      icon={assetView === "active" ? VideoIcon : ArchiveIcon}
                      title={
                        tx(assetView === "active"
                          ? "素材库准备好了"
                          : "没有归档的素材")
                      }
                      description={
                        tx(assetView === "active"
                          ? "添加授权视频与文案，创作者就能在任务详情中直接预览和下载。"
                          : "归档后的素材可以随时恢复，原始文件会保留在本机。")
                      }
                    />
                  ))}
                </>
              ))}
              {lx(page === "publish" && (
                <>
                  <div className="s-publish-heading">
                    <span>{tx("NEW STORY, NEW POSSIBILITIES")}</span>
                    <h2>{tx("下一个好故事，")}<br />{tx("从你开始。")}</h2>
                    <p>{tx("填写清晰的任务要求，让创作者更容易开始。")}</p>
                  </div>
                  <Section title={tx("剧集封面")}>
                    <div className="s-cover-picker">
                      <img src={form.cover} alt={tx("任务封面预览")} />
                      <div>
                        <Button
                          kind="secondary"
                          disabled={uploading}
                          onClick={() => {
                            keyboard.hide();
                            coverRef.current?.click();
                          }}
                        >
                          <UploadIcon />
                          {lx(uploading ? "保存中" : "上传封面")}
                        </Button>
                        <p>{tx("竖版图片 · 建议 2:3")}<br />{tx("PNG / JPG / WebP，5 MB 以内")}</p>
                      </div>
                    </div>
                    <Carousel
                      ariaLabel={tx('选择预设封面')}
                      contentClassName="s-cover-presets"
                    >
                      {lx(data.tasks.slice(0, 5).map((t) => (
                        <button
                          className={form.cover === t.cover ? "selected" : ""}
                          key={t.id}
                          onClick={() =>
                            setForm((f) => ({ ...f, cover: t.cover }))
                          }
                        >
                          <img src={t.cover} alt={tx("使用" + t.title + "封面")} />
                        </button>
                      )))}
                    </Carousel>
                    <input
                      className="s-file-input"
                      ref={coverRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => uploadCover(e.target.files)}
                      aria-label={tx("选择剧集封面")}
                    />
                  </Section>
                  <div className="s-publish-fields">
                    <label className="s-field">
                      <span>{tx("剧集名称")}</span>
                      <KeyboardInput
                        {...onFocus}
                        maxLength={60}
                        placeholder={tx("为你的故事取个名字")}
                        value={form.title}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, title: e.target.value }))
                        }
                      />
                    </label>
                    <div className="s-field-pair">
                      <label className="s-field">
                        <span>{tx("发布平台")}</span>
                        <select
                          value={form.platform}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, platform: e.target.value }))
                          }
                        >
                          {lx(["TikTok", "YouTube", "Facebook"].map((x) => (
                            <option key={x}>{lx(x)}</option>
                          )))}
                        </select>
                      </label>
                      <label className="s-field">
                        <span>{tx("剧集语言")}</span>
                        <select
                          value={form.language}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, language: e.target.value }))
                          }
                        >
                          <option value="中文">{tx("中文")}</option>
                          <option value="英文">{tx("英文")}</option>
                        </select>
                      </label>
                    </div>
                    <label className="s-field">
                      <span>{tx("题材分类")}</span>
                      <KeyboardInput
                        {...onFocus}
                        maxLength={30}
                        value={form.genre}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, genre: e.target.value }))
                        }
                      />
                    </label>
                    <div className="s-field-pair">
                      {lx([
                        ["episodes", "剧集集数"],
                        ["posts", "需发布视频数"],
                        ["deposit", "预付额度（USD）"],
                        ["commission", "任务佣金（USD）"],
                      ].map(([key, label]) => (
                        <label className="s-field" key={key}>
                          <span>{lx(label)}</span>
                          <KeyboardInput
                            {...onFocus}
                            type="number"
                            min="0"
                            value={form[key as keyof typeof form]}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, [key]: e.target.value }))
                            }
                          />
                        </label>
                      )))}
                    </div>
                    <label className="s-field">
                      <span>{tx("故事简介与创作说明")}</span>
                      <KeyboardTextarea
                        {...onFocus}
                        maxLength={2000}
                        placeholder={tx("介绍剧情看点、受众与创作建议…")}
                        value={form.description}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            description: e.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <Button disabled={busy || uploading} onClick={publish}>
                    {lx(busy ? "发布中…" : "发布到剧场片库")}
                    <ArrowRightIcon />
                  </Button>
                </>
              ))}
            </>
          ))}
        </main>
      </MobileScroll>
      {lx(data && hasNav && !keyboard.visible && (
        <nav className="s-bottom-nav" aria-label={tx("主导航")}>
          {lx(navItems.map(({ page: p, label, Icon }) => (
            <button
              key={p}
              aria-current={page === p ? "page" : undefined}
              className={page === p ? "active" : ""}
              onClick={() => go(p, true)}
            >
              <span>
                <Icon />
                {lx(p === "tasks" && data.counts.review > 0 && <i />)}
              </span>
              {lx(label)}
            </button>
          )))}
        </nav>
      ))}
      {lx(data && page === "detail" && task && (
        <footer className="s-action-footer single" style={footerStyle}>
          <Button
            onClick={() => {
              const existing = data.assignments.find(
                (a) =>
                  a.task_id === task.id &&
                  ["active", "review", "revision"].includes(a.status),
              );
              if (existing) viewAssignment(existing);
              else go("hall", true);
            }}
          >
            {lx(currentClaim ? "查看已有任务" : "继续当前任务")} <ArrowRightIcon />
          </Button>
        </footer>
      ))}
      {lx(data && page === "assignment" && assignment && !reviewer && (
        <footer className="s-action-footer single" style={footerStyle}>
          {lx(["active", "revision"].includes(assignment.status) ? (
            <Button onClick={() => go("submit")}>{tx("提交作品")}<ArrowRightIcon />
            </Button>
          ) : assignment.status === "completed" ? (
            <Button onClick={() => go("wallet", true)}>{tx("查看到账明细")}<ArrowRightIcon />
            </Button>
          ) : assignment.status === "cancelled" ? (
            <Button onClick={() => go("hall", true)}>{tx("发现更多任务")}</Button>
          ) : (
            <Button kind="secondary" disabled onClick={() => {}}>{tx("等待平台审核")}</Button>
          ))}
        </footer>
      ))}
      {lx(data && page === "submit" && assignment && (
        <footer className="s-action-footer single" style={footerStyle}>
          <Button disabled={busy || uploading} onClick={submit}>
            {lx(busy ? "提交中…" : "确认提交审核")}
            <ArrowRightIcon />
          </Button>
        </footer>
      ))}
      {lx(toast &&
        screenRef.current &&
        createPortal(
          <div
            role={toast.error ? "alert" : "status"}
            className={"s-toast " + (toast.error ? "error" : "")}
            style={{ bottom: Math.max(110, insets.bottomInset + 18) }}
          >
            {lx(toast.error ? <ExclamationTriangleIcon /> : <CheckCircledIcon />)}
            {lx(toast.message)}
          </div>,
          screenRef.current,
        ))}
      <BottomSheet
        open={!!modal}
        onOpenChange={(value) => !value && setModal(null)}
        title={
          tx({
            preview: preview?.name || "图片预览",
            profile: "编辑个人资料",
            guide: "创作指南",
            rules: "费用与结算说明",
            approve: "确认审核通过",
            changes: "发送修改意见",
            cancel: "取消任务",
            install: "添加到主屏幕",
            video: videoPreview?.name || "视频预览",
            "archive-material": "归档素材",
            history: "提交与审核历史",
          }[modal || ""] || "详情")
        }
        description={tx("AI CREATOR")}
      >
        <div className="s-sheet-content">
          <button
            className="s-sheet-close"
            aria-label={tx("关闭面板")}
            onClick={() => setModal(null)}
          >
            <Cross2Icon />
          </button>
          {lx(modal === "history" && assignment && (
            <SubmissionHistory submissions={assignment.submissions} />
          ))}
          {lx(modal === "preview" && preview && (
            <div className="s-image-preview">
              <img src={preview.src} alt={tx(preview.name)} />
              <a href={preview.src} download>
                <DownloadIcon />{tx("下载原图")}</a>
            </div>
          ))}
          {lx(modal === "profile" && (
            <>
              <div className="profile-edit-account"><span>{tx("登录账号","field")}</span><b>{user.email}</b></div>
              <ProfileAccountId id={user.id}/>
              <label className="s-field">
                <span>{tx("昵称")}</span>
                <KeyboardInput
                  {...onFocus}
                  maxLength={30}
                  value={profileForm.name}
                  onChange={(e) =>
                    setProfileForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </label>
              <Button
                disabled={busy}
                onClick={async () => {
                  const r = await perform(
                    () => api("/profile", "PATCH", profileForm),
                    "资料已保存",
                  );
                  if (r) setModal(null);
                }}
              >{tx("保存资料")}<CheckIcon />
              </Button>
            </>
          ))}
          {lx(modal === "guide" && (
            <div className="s-guide">
              {lx([
                [
                  "领取当前任务",
                  "从当前计划领取任务后，查看本次作品、金额和预计收益。",
                ],
                [
                  "核对购买信息",
                  "版权任务展示封面与剧情。领取时预留本单可用余额，不足时补齐差额后完成购买。",
                ],
                [
                  "查看本单版权码",
                  "完成购买后，版权码会保存在当前任务中，刷新后仍可查看。",
                ],
                [
                  "复制并完成任务",
                  "点击当前任务中的复制并提交按钮，提交本单版权码即可完成，无需上传截图。",
                ],
                [
                  "查看结算与记录",
                  "版权码核验成功后返还购买金额并发放佣金。完成记录与资金流水可随时查看。",
                ],
              ].map(([title, copy], i) => (
                <section key={title}>
                  <span>{lx(String(i + 1).padStart(2, "0"))}</span>
                  <div>
                    <h3>{lx(title)}</h3>
                    <p>{lx(copy)}</p>
                  </div>
                </section>
              )))}
            </div>
          ))}
          {lx(modal === "rules" && (
            <div className="s-prose">
              <h3>{tx("每一笔变化，都有记录")}</h3>
              <p>{tx("钱包按 USD 记账，充值经核实到账后入账。提现需完成实名认证、保存本人收款方式并验证资金密码，处理进度可在提款记录查看。")}</p>
              <h4>{tx("任务记录")}</h4>
              <p>{tx("以当前作品展示的金额、完成佣金和任务要求为准。接受后可在任务记录中查看。")}</p>
              <h4>{tx("版权码提交")}</h4>
              <p>{tx("版权购买成功后，复制并提交本订单的版权码即可完成任务。")}</p>
              <h4>{tx("结算记录")}</h4>
              <p>{tx("版权码核验完成后，购买金额返还，佣金另行计入钱包。已揭晓的金额会保留，刷新不会重新报价；具体记录可在钱包查看。")}</p>
            </div>
          ))}
          {lx(modal === "approve" && assignment && (
            <>
              <div className="s-approval-summary">
                <CheckCircledIcon />
                <h3>{tx("确认这份作品符合任务要求")}</h3>
                <p>{tx("通过后会返还")}{lx(money(assignment.task.deposit))}{tx(" 任务本金，并记入")}{lx(" ")}
                  {lx(money(assignment.task.commission))}{tx("任务佣金。")}</p>
              </div>
              {lx([
                "已核对所有视频链接",
                "截图与发布账号、视频一致",
                "内容符合任务要求",
              ].map((label, i) => (
                <label className="s-checkbox-row" key={label}>
                  <input
                    type="checkbox"
                    checked={reviewChecks[i]}
                    onChange={(e) =>
                      setReviewChecks((old) =>
                        old.map((v, n) => (n === i ? e.target.checked : v)),
                      )
                    }
                  />
                  <span>{lx(label)}</span>
                </label>
              )))}
              <Button
                disabled={busy || !reviewChecks.every(Boolean)}
                onClick={() => review("approve")}
              >{tx("确认通过并结算")}<CheckIcon />
              </Button>
            </>
          ))}
          {lx(modal === "changes" && (
            <>
              <p className="s-field-help">{tx("清晰的反馈能帮助创作者更快完成修改。说明需要调整的具体视频、截图或内容。")}</p>
              <label className="s-field">
                <span>{tx("修改意见")}</span>
                <KeyboardTextarea
                  {...onFocus}
                  maxLength={1000}
                  placeholder={tx("例如：第 2 条视频截图未显示发布状态，请补充清晰截图。")}
                  aria-label={tx("审核修改意见")}
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                />
              </label>
              <Button
                disabled={busy || !reviewReason.trim()}
                onClick={() => review("changes")}
              >{tx("发送修改意见")}<ArrowRightIcon />
              </Button>
            </>
          ))}
          {lx(modal === "video" && videoPreview && (
            <div className="s-video-preview">
              <video
                src={videoPreview.path}
                controls
                playsInline
                preload="metadata"
                data-scroll-drag="ignore"
              />
              <a href={videoPreview.path} download={videoPreview.name}>
                <DownloadIcon />{tx("下载原文件 ·")}{lx(fileSize(videoPreview.size))}
              </a>
            </div>
          ))}
          {lx(modal === "archive-material" && archiveTarget && (
            <>
              <div className="s-approval-summary">
                <ArchiveIcon />
                <h3>{tx("将这份素材移入归档？")}</h3>
                <p>{lx(archiveTarget.name)}</p>
                <p>{tx("归档后不再显示在任务详情中。原始文件会保留，可在“已归档”中恢复。")}</p>
              </div>
              <Button
                disabled={busy}
                onClick={() => updateMaterial(archiveTarget)}
              >{tx("确认归档")}</Button>
            </>
          ))}
          {lx(modal === "install" && (
            <>
              <div className="s-install-heading">
                <BrandMark/>
                <h3>{tx("把创作工作台，留在主屏幕")}</h3>
                <p>{tx("以独立窗口打开，随时回来继续创作。")}</p>
              </div>
              {lx(installPrompt ? (
                <Button
                  onClick={async () => {
                    await installPrompt.prompt();
                    const choice = await installPrompt.userChoice;
                    if (choice.outcome === "accepted") {
                      say("安装请求已确认");
                      setModal(null);
                    }
                    setInstallPrompt(null);
                  }}
                >
                  <MobileIcon />{tx("安装应用")}</Button>
              ) : (
                <div className="s-prose">
                  <h4>{tx("在手机上")}</h4>
                  <p>{tx("打开浏览器菜单或分享菜单，选择“添加到主屏幕”。部分浏览器会显示“安装应用”。")}</p>
                  <h4>{tx("在电脑上")}</h4>
                  <p>{tx("如果浏览器提供安装入口，可从地址栏或浏览器菜单安装。")}</p>
                </div>
              ))}
              <div className="s-info-note">
                <LockClosedIcon />
                <span>{tx("安装后使用同一平台账号登录。任务、资金和审核需要网络连接，离线时不能提交。")}</span>
              </div>
            </>
          ))}
          {lx(modal === "cancel" && assignment && (
            <>
              <div className="s-approval-summary">
                <ExclamationTriangleIcon />
                <h3>{tx("确认取消这项任务？")}</h3>
                <p>
                  {lx(money(assignment.task.deposit))}{lx(" ")}{tx("任务本金会返还可用余额。已有提交记录与任务时间线会保留。")}</p>
              </div>
              <Button
                disabled={busy}
                kind="danger"
                onClick={async () => {
                  const r = await perform(
                    () =>
                      api(
                        "/assignments/" + assignment.id + "/cancel",
                        "POST",
                        {},
                      ),
                    "任务已取消，任务本金已返还",
                  );
                  if (r) setModal(null);
                }}
              >{tx("确认取消任务")}</Button>
              <Button kind="secondary" onClick={() => setModal(null)}>{tx("继续创作")}</Button>
            </>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}
