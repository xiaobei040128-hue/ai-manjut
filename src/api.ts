export type Status =
  | "active"
  | "review"
  | "revision"
  | "completed"
  | "cancelled";
export interface Task {
  stage: number;
  commission_rate_bps: number | null;
  materials: Material[];
  id: string;
  title: string;
  platform: string;
  episodes: number;
  language: string;
  deposit: number;
  commission: number;
  posts: number;
  genre: string;
  description: string;
  cover: string;
  badge: string;
  slots: number;
  remaining: number;
  active: number;
  bookmarked: boolean;
  created_at: string;
  regions: string[];
  tags: string[];
}
export interface Upload {
  id: string;
  assignment_id: string | null;
  name: string;
  mime: string;
  size: number;
  path: string;
  created_at: string;
}
export interface Submission {
  id: string;
  assignment_id: string;
  version: number;
  links: string[];
  note: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  review_note: string;
  uploads: Upload[];
}
export interface Assignment {
  owner_id: string;
  id: string;
  task_id: string;
  status: Status;
  created_at: string;
  deadline: string;
  draft: { links?: string[]; note?: string; savedAt?: string };
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string;
  task: Task;
  uploads: Upload[];
  events: {
    id: number;
    type: string;
    description: string;
    created_at: string;
  }[];
  submissions: Submission[];
}
export interface Ledger {
  owner_id: string;
  id: number;
  assignment_id: string | null;
  kind: string;
  amount: number;
  balance_after: number;
  note: string;
  created_at: string;
}
export interface Notice {
  task_id: string | null;
  id: string;
  title: string;
  body: string;
  assignment_id: string | null;
  is_read: number;
  created_at: string;
}
export interface Bootstrap {
  profile: {
    id: number;
    name: string;
    bio: string;
    channel: string;
    created_at: string;
  };
  wallet: {
    available: number;
    held: number;
    withdrawalHeld: number;
    earned: number;
    currency: string;
    testMode: boolean;
  };
  counts: { active: number; review: number; completed: number };
  assignments: Assignment[];
  ledger: Ledger[];
  notifications: Notice[];
  bookmarks: string[];
  savedTasks?: Task[];
  tasks: Task[];
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  input?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api" + path, {
      signal: AbortSignal.timeout(20000),
      method,
      headers:
        method === "GET"
          ? {}
          : { "Content-Type": "application/json", "X-Workspace-Request": "1" },
      body: input === undefined ? undefined : JSON.stringify(input),
    });
  } catch (error) {
    if (error instanceof DOMException && ["TimeoutError", "AbortError"].includes(error.name)) throw new Error(method === "GET" ? "读取超时，请检查连接后重试" : "请求超时，结果可能已保存；请先刷新核对，避免重复提交");
    throw new Error("暂时无法连接工作区，请确认本地服务仍在运行");
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("服务连接中断，请稍后重试");
  }
  if (!response.ok) {
    if ([401, 403].includes(response.status) && ["/bootstrap", "/journey"].includes(path))
      window.dispatchEvent(
        new CustomEvent("creator-session-expired", { detail: result.error }),
      );
    throw new ApiError(result.error || "操作失败", response.status);
  }
  return result as T;
}
export function fileData(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("无法读取文件"));
    reader.readAsDataURL(file);
  });
}
export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
export const date = (iso: string, full = false) =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    ...(full ? { year: "numeric" } : {}),
  }).format(new Date(iso));
export const statusText: Record<Status, string> = {
  active: "进行中",
  review: "审核中",
  revision: "待修改",
  completed: "已完成",
  cancelled: "已取消",
};
export function timeLeft(iso: string) {
  const h = Math.ceil((Date.parse(iso) - Date.now()) / 3600e3);
  return h < 0 ? "已超时" : h < 1 ? "不足 1 小时" : h + " 小时";
}
export interface Material {
  id: string;
  task_id: string;
  name: string;
  mime: string;
  size: number;
  path: string;
  kind: "video" | "document";
  active: number;
  created_at: string;
}
export interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}
export function uploadMaterial(
  taskId: string,
  file: File,
  onProgress: (percentage: number) => void,
): Promise<Material> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/tasks/" + encodeURIComponent(taskId) + "/materials");
    xhr.setRequestHeader("X-Workspace-Request", "1");
    xhr.timeout = 120000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      let result;
      try {
        result = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error("素材服务响应异常"));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(result);
      else reject(new Error(result.error || "上传失败"));
    };
    xhr.onerror = () => reject(new Error("无法连接素材服务，请重试"));
    xhr.ontimeout = () => reject(new Error("上传超时，请检查文件大小并重试"));
    xhr.onabort = () => reject(new Error("上传已取消"));
    const data = new FormData();
    data.append("file", file);
    xhr.send(data);
  });
}
export const fileSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? (bytes / 1024 / 1024).toFixed(1) + " MB"
    : Math.max(1, Math.round(bytes / 1024)) + " KB";
