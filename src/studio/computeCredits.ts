export type ComputeEntry = {
  id: string;
  label: string;
  delta: number;
  at: string;
};
export type ComputeState = {
  version: 1;
  owner: string;
  credits: number;
  entries: ComputeEntry[];
};
export const computePacks = [
  { credits: 100, price: "4.99", name: "轻量体验" },
  { credits: 300, price: "12.99", name: "日常创作" },
  { credits: 800, price: "29.99", name: "灵感进阶" },
] as const;
export function newCompute(owner: string): ComputeState {
  return {
    version: 1,
    owner,
    credits: 80,
    entries: [
      {
        id: "welcome",
        label: "免费体验额度",
        delta: 80,
        at: new Date().toISOString(),
      },
    ],
  };
}
export function computeChange(
  s: ComputeState,
  id: string,
  label: string,
  delta: number,
): ComputeState {
  if (s.entries.some((e) => e.id === id)) return s;
  if (!Number.isSafeInteger(delta) || s.credits + delta < 0)
    throw new Error("创作额度不足");
  return {
    ...s,
    credits: s.credits + delta,
    entries: [{ id, label, delta, at: new Date().toISOString() }, ...s.entries],
  };
}
export function validCompute(s: unknown, owner: string): s is ComputeState {
  if (!s || typeof s !== "object") return false;
  const v = s as ComputeState;
  return (
    v.version === 1 &&
    v.owner === owner &&
    Number.isSafeInteger(v.credits) &&
    v.credits >= 0 &&
    Array.isArray(v.entries) &&
    v.entries.length <= 10000 &&
    v.entries.every(
      (e) =>
        typeof e.id === "string" &&
        typeof e.label === "string" &&
        Number.isSafeInteger(e.delta) &&
        Number.isFinite(Date.parse(e.at)),
    ) &&
    new Set(v.entries.map((e) => e.id)).size === v.entries.length &&
    v.entries.reduce((n, e) => n + e.delta, 0) === v.credits
  );
}
