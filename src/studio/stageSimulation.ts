export const SIMULATION_VERSION = 1;
export const amountRanges = [
  [1000, 3000],
  [500, 1500],
  [3000, 5500],
  [1900, 3300],
  [8800, 9900],
  [800, 1900],
] as const;
export const demoDramas = [
  {
    title: "总裁的秘密妻子",
    cover: "/art/hero-v2.webp",
    genre: "都市爱情",
    platform: "TikTok",
    brief: "选择一段剧情反转，制作 15–30 秒竖屏预告。",
  },
  {
    title: "重生之复仇女王",
    cover: "/art/revenge-v2.webp",
    genre: "重生逆袭",
    platform: "YouTube",
    brief: "围绕女主逆袭片段，制作一条带字幕的短视频。",
  },
  {
    title: "校园甜宠日记",
    cover: "/art/campus-v2.webp",
    genre: "青春校园",
    platform: "TikTok",
    brief: "用一段心动情节，剪辑节奏轻快的故事预告。",
  },
  {
    title: "狼人王子的契约新娘",
    cover: "/art/wolf-v2.webp",
    genre: "奇幻爱情",
    platform: "Facebook",
    brief: "选择奇幻主线片段，突出人物冲突与悬念。",
  },
  {
    title: "末世生存者",
    cover: "/art/survival-v2.webp",
    genre: "末日冒险",
    platform: "YouTube",
    brief: "剪辑危机场景，保留故事悬念，加入清晰字幕。",
  },
] as const;
export type DemoOrder = {
  id: string;
  sequence: number;
  amount: number;
  rate: number;
  commission: number;
  drama: number;
};
export type Simulation = {
  community?: { completed: number; genre: string; rating: number; review: string; shared: boolean; code: string; exampleQuote?: ExampleQuote };
  version: 1;
  id: string;
  createdAt: string;
  orders: DemoOrder[];
  completed: number;
  status: "ready" | "working" | "review" | "stage_review" | "settled";
  reviewMode?: "automatic" | "selective" | "stage" | "manual";
  reviewOrders?: number[];
  revisionOrder?: number;
  revealed: boolean;
};
function integer(min: number, max: number, random: () => number) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1)
    throw new Error("Invalid random source");
  return min + Math.floor(value * (max - min + 1));
}
export function createSimulation(
  count?: 5 | 6,
  random: () => number = Math.random,
): Simulation {
  const total = count ?? integer(5, 6, random);
  if (total !== 5 && total !== 6) throw new Error("Invalid task count");
  const pool = demoDramas.map((_, i) => i);
  let previous = -1;
  const orders = amountRanges.slice(0, total).map(([min, max], index) => {
    const amount = integer(min, max, random),
      rate = integer(300, 600, random);
    if (!pool.length)
      pool.push(...demoDramas.map((_, i) => i).filter((i) => i !== previous));
    const drama = pool.splice(integer(0, pool.length - 1, random), 1)[0];
    previous = drama;
    return {
      id: `demo-${index + 1}`,
      sequence: index + 1,
      amount,
      rate,
      commission: Math.round((amount * rate) / 10000),
      drama,
    };
  });
  return {
    version: SIMULATION_VERSION,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    orders,
    completed: 0,
    status: "ready",
    revealed: false,
    reviewMode: "stage",
    reviewOrders: [],
  };
}
export function validateSimulation(value: unknown): value is Simulation {
  if (!value || typeof value !== "object") return false;
  const s = value as Simulation;
  if (
    s.version !== 1 ||
    typeof s.id !== "string" ||
    typeof s.createdAt !== "string" ||
    !Number.isFinite(Date.parse(s.createdAt)) ||
    !Array.isArray(s.orders) ||
    ![5, 6].includes(s.orders.length) ||
    !Number.isInteger(s.completed) ||
    s.completed < 0 ||
    s.completed > s.orders.length ||
    typeof s.revealed !== "boolean" ||
    !["ready", "working", "review", "stage_review", "settled"].includes(
      s.status,
    )
  )
    return false;
  if (
    (["settled", "stage_review"].includes(s.status) &&
      s.completed !== s.orders.length) ||
    (!["settled", "stage_review"].includes(s.status) &&
      s.completed === s.orders.length)
  )
    return false;
  if (["working", "review"].includes(s.status) && !s.revealed) return false;
  if (
    s.reviewMode !== undefined &&
    !["automatic", "selective", "stage", "manual"].includes(s.reviewMode)
  )
    return false;
  if (
    s.reviewOrders !== undefined &&
    (!Array.isArray(s.reviewOrders) ||
      s.reviewOrders.some(
        (n) => !Number.isInteger(n) || n < 1 || n > s.orders.length,
      ))
  )
    return false;
  if (
    s.revisionOrder !== undefined &&
    (!Number.isInteger(s.revisionOrder) ||
      s.revisionOrder < 0 ||
      s.revisionOrder >= s.orders.length)
  )
    return false;
  if (s.community !== undefined) {
    const c = s.community;
    if (c.exampleQuote !== undefined && !validExampleQuote(c.exampleQuote)) return false;
    if (!c || !Number.isInteger(c.completed) || c.completed < 0 || c.completed > 5 ||
        typeof c.genre !== "string" || c.genre.length > 40 || !Number.isInteger(c.rating) || c.rating < 0 || c.rating > 5 ||
        typeof c.review !== "string" || c.review.length > 500 || typeof c.shared !== "boolean" ||
        typeof c.code !== "string" || (c.code !== "" && !/^[A-Z2-9]{8}$/.test(c.code))) return false;
  }
  return s.orders.every((o, i) => {
    if (!o || typeof o !== "object") return false;
    const [min, max] = amountRanges[i];
    return (
      o.sequence === i + 1 &&
      typeof o.id === "string" &&
      Number.isInteger(o.amount) &&
      o.amount >= min &&
      o.amount <= max &&
      Number.isInteger(o.rate) &&
      o.rate >= 300 &&
      o.rate <= 600 &&
      o.commission === Math.round((o.amount * o.rate) / 10000) &&
      Number.isInteger(o.drama) &&
      o.drama >= 0 &&
      o.drama < demoDramas.length
    );
  });
}
export function transitionSimulation(
  s: Simulation,
  event: "reveal" | "start" | "submit" | "approve" | "revise",
): Simulation {
  if (event === "reveal" && s.status === "ready")
    return { ...s, revealed: true };
  if (event === "start" && s.status === "ready" && s.revealed)
    return { ...s, status: "working" };
  const mode = s.reviewMode || "manual";
  function advance(): Simulation {
    const completed =
      s.revisionOrder === undefined ? s.completed + 1 : s.orders.length;
    return {
      ...s,
      completed,
      revisionOrder: undefined,
      status:
        completed === s.orders.length
          ? mode === "automatic"
            ? "settled"
            : mode === "manual"
              ? "settled"
              : "stage_review"
          : "ready",
      revealed: false,
    };
  }
  if (event === "submit" && s.status === "working") {
    if (
      mode === "manual" ||
      (mode === "selective" && s.reviewOrders?.includes(s.completed + 1))
    )
      return { ...s, status: "review" };
    return advance();
  }
  if (event === "approve" && s.status === "stage_review")
    return { ...s, status: "settled" };
  if (event === "revise" && s.status === "stage_review")
    return {
      ...s,
      completed: s.orders.length - 1,
      revisionOrder: s.orders.length - 1,
      status: "working",
      revealed: true,
    };
  if (event === "revise" && s.status === "review")
    return { ...s, status: "working" };
  if (event === "approve" && s.status === "review") {
    return advance();
  }
  return s;
}
export const simulatedMoney = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );

export type ExampleQuote = { amount: number; rate: number; commission: number };
export function createExampleQuote(random: () => number = Math.random): ExampleQuote {
  function integer(min: number, max: number) {
    const n = random();
    if (!Number.isFinite(n) || n < 0 || n >= 1) throw new Error("Invalid random source");
    return min + Math.floor(n * (max - min + 1));
  }
  const amount = integer(27700, 29800);
  const rate = integer(250, 380);
  return { amount, rate, commission: Math.round(amount * rate / 10000) };
}
export function validExampleQuote(q: unknown): q is ExampleQuote {
  if (!q || typeof q !== "object") return false;
  const value = q as ExampleQuote;
  return Number.isInteger(value.amount) && value.amount >= 27700 && value.amount <= 29800 &&
    Number.isInteger(value.rate) && value.rate >= 250 && value.rate <= 380 &&
    value.commission === Math.round(value.amount * value.rate / 10000);
}
