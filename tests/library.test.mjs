import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "./fixtures/store.mjs";
import { createCreatorAuth } from "../server/creator-auth.mjs";
test("saved stories remain visible after pause and never leak another owner bookmarks", async () => {
  const store = createStore(":memory:"),
    auth = createCreatorAuth(store, 4931),
    invite = auth.createInvite("qa", { label: "Saved story isolation" });
  try {
    const register = async (email) =>
      (
        await auth.register(
          { headers: {}, socket: { remoteAddress: email } },
          { email, password: "Library-QA-Password!", inviteCode: invite.code },
        )
      ).user;
    const a = await register("library-a@example.com"),
      b = await register("library-b@example.com");
    store.asUser(a.id, () => store.bookmark("secret-wife"));
    store.setTaskActive("secret-wife", false);
    const saved = store.asUser(a.id, () => store.summary());
    assert.ok(!saved.tasks.some((t) => t.id === "secret-wife"));
    assert.equal(saved.savedTasks.length, 1);
    assert.equal(saved.savedTasks[0].id, "secret-wife");
    assert.equal(saved.savedTasks[0].active, 0);
    assert.equal(saved.savedTasks[0].bookmarked, true);
    assert.equal(
      store.asUser(b.id, () => store.summary()).savedTasks.length,
      0,
    );
    store.asUser(a.id, () => store.bookmark("secret-wife"));
    assert.equal(
      store.asUser(a.id, () => store.summary()).savedTasks.length,
      0,
    );
  } finally {
    store.close();
  }
});
