export type NewcomerSession = {
  version: 1;
  stage: number;
  depositCents: 168 | 188;
  review: boolean;
  paying: boolean;
  method: "uid" | "btc";
};
export const freshNewcomer = (): NewcomerSession => ({
  version: 1,
  stage: 1,
  depositCents: Math.random() < 0.5 ? 168 : 188,
  review: false,
  paying: false,
  method: "uid",
});
export function validNewcomer(value: unknown): value is NewcomerSession {
  if (!value || typeof value !== "object") return false;
  const s = value as NewcomerSession;
  return (
    s.version === 1 &&
    Number.isInteger(s.stage) &&
    s.stage >= 1 &&
    s.stage <= 6 &&
    [168, 188].includes(s.depositCents) &&
    typeof s.review === "boolean" &&
    typeof s.paying === "boolean" &&
    ["uid", "btc"].includes(s.method)
  );
}
