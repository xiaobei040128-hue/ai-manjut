import { AppError } from "./store.mjs";
import { freshNewcomer, validNewcomer } from "../src/studio/newcomerState.ts";
import {
  createSimulation,
  validateSimulation,
} from "../src/studio/stageSimulation.ts";
export function createJourneys(store) {
  const db = store.db;
  db.exec(
    `CREATE TABLE IF NOT EXISTS creator_preview_journeys(user_id TEXT PRIMARY KEY REFERENCES creator_accounts(id),newcomer TEXT NOT NULL,advanced TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL)`,
  );
  function get(userId) {
    let row = db
      .prepare("SELECT * FROM creator_preview_journeys WHERE user_id=?")
      .get(userId);
    if (!row) {
      db.prepare(
        "INSERT OR IGNORE INTO creator_preview_journeys(user_id,newcomer,advanced,updated_at) VALUES(?,?,?,?)",
      ).run(
        userId,
        JSON.stringify(freshNewcomer()),
        JSON.stringify(createSimulation()),
        new Date().toISOString(),
      );
      row = db
        .prepare("SELECT * FROM creator_preview_journeys WHERE user_id=?")
        .get(userId);
    }
    return {
      ownerId: userId,
      newcomer: JSON.parse(row.newcomer),
      advanced: JSON.parse(row.advanced),
      revision: row.revision,
      updatedAt: row.updated_at,
      simulationOnly: true,
    };
  }
  function save(userId, input) {
    if (input.ownerId !== userId)
      throw new AppError("登录账号已改变，请重新读取当前账号进度", 409);
    if (
      !Number.isSafeInteger(input.revision) ||
      input.revision < 0 ||
      !["newcomer", "advanced"].includes(input.kind)
    )
      throw new AppError("无效阶段记录");
    const validate =
      input.kind === "newcomer" ? validNewcomer : validateSimulation;
    if (!validate(input.value)) throw new AppError("阶段记录格式不正确");
    return store.audited(
      "creator",
      "journey.preview_save",
      userId,
      () => {
        const current = get(userId);
        if (current.revision !== input.revision)
          throw new AppError("进度已在其他页面更新，请重新读取", 409);
        if (input.kind === "advanced" && current.newcomer.stage !== 6)
          throw new AppError("请先完成新手阶段", 409);
        const result = db
          .prepare(
            `UPDATE creator_preview_journeys SET ${input.kind}=?,revision=revision+1,updated_at=? WHERE user_id=? AND revision=?`,
          )
          .run(
            JSON.stringify(input.value),
            new Date().toISOString(),
            userId,
            input.revision,
          );
        if (!result.changes) throw new AppError("进度已更新，请重新读取", 409);
        return get(userId);
      },
      { kind: input.kind },
    );
  }
  return { get, save };
}
