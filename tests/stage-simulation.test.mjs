import test from "node:test";
import assert from "node:assert/strict";
import {
  amountRanges,
  createSimulation,
  transitionSimulation,
  validateSimulation,
} from "../src/studio/stageSimulation.ts";
test("simulation respects all amount bands, precision and commission boundaries", () => {
  for (const sample of [0, 0.001, 0.25, 0.5, 0.75, 0.999999])
    for (const count of [5, 6]) {
      const session = createSimulation(count, () => sample);
      assert.equal(session.orders.length, count);
      assert.ok(validateSimulation(session));
      assert.equal(
        new Set(session.orders.slice(0, 5).map((o) => o.drama)).size,
        5,
      );
      if (count === 6)
        assert.notEqual(session.orders[4].drama, session.orders[5].drama);
      session.orders.forEach((o, i) => {
        assert.ok(
          o.amount >= amountRanges[i][0] && o.amount <= amountRanges[i][1],
        );
        assert.ok(o.rate >= 300 && o.rate <= 600);
        assert.ok(Number.isInteger(o.commission));
        assert.equal(o.commission, Math.round((o.amount * o.rate) / 10000));
      });
    }
  assert.equal(createSimulation(5, () => 0).orders[0].amount, 1000);
  assert.equal(createSimulation(6, () => 0.999999).orders[5].amount, 1900);
  assert.throws(() => createSimulation(6, () => 1));
  assert.throws(() => createSimulation(6, () => NaN));
});
test("random task count covers 5 and 6 and amounts stay fixed through workflow", () => {
  assert.equal(createSimulation(undefined, () => 0).orders.length, 5);
  assert.equal(createSimulation(undefined, () => 0.999999).orders.length, 6);
  let s = { ...createSimulation(6, () => 0.5), reviewMode: "manual" };
  const orders = JSON.stringify(s.orders);
  assert.equal(transitionSimulation(s, "approve"), s);
  assert.equal(transitionSimulation(s, "submit"), s);
  for (let i = 0; i < 6; i++) {
    s = transitionSimulation(s, "reveal");
    s = transitionSimulation(s, "start");
    s = transitionSimulation(s, "submit");
    assert.equal(s.completed, i);
    s = transitionSimulation(s, "revise");
    assert.equal(s.status, "working");
    s = transitionSimulation(s, "submit");
    s = transitionSimulation(s, "approve");
    assert.equal(s.completed, i + 1);
    assert.equal(JSON.stringify(s.orders), orders);
    assert.ok(validateSimulation(s));
    const repeated = transitionSimulation(s, "approve");
    assert.equal(repeated, s);
  }
  assert.equal(s.status, "settled");
  assert.equal(transitionSimulation(s, "start"), s);
});
test("saved simulations reject corrupt amounts and impossible completion states", () => {
  const s = createSimulation(5, () => 0.5);
  assert.ok(!validateSimulation(null));
  assert.ok(!validateSimulation({ ...s, completed: 7 }));
  assert.ok(!validateSimulation({ ...s, status: "settled" }));
  assert.ok(!validateSimulation({ ...s, version: 2 }));
  assert.ok(
    !validateSimulation({
      ...s,
      orders: s.orders.map((o, i) => (i ? o : { ...o, amount: -1 })),
    }),
  );
  assert.ok(
    !validateSimulation({
      ...s,
      orders: s.orders.map((o, i) => (i ? o : { ...o, commission: 99999 })),
    }),
  );
});

test("stage review advances ordinary tasks instantly and settles once after batch approval", () => {
  let s = createSimulation(5, () => 0.5);
  for (let i = 0; i < 5; i++) {
    s = transitionSimulation(s, "reveal");
    s = transitionSimulation(s, "start");
    s = transitionSimulation(s, "submit");
    assert.equal(s.completed, i + 1);
    assert.ok(validateSimulation(s));
  }
  assert.equal(s.status, "stage_review");
  s = transitionSimulation(s, "revise");
  assert.equal(s.completed, 4);
  assert.equal(s.status, "working");
  s = transitionSimulation(s, "submit");
  assert.equal(s.completed, 5);
  assert.equal(s.status, "stage_review");
  s = transitionSimulation(s, "approve");
  assert.equal(s.status, "settled");
  assert.equal(transitionSimulation(s, "approve"), s);
});
test("selective review blocks only configured tasks; automatic review completes without batch hold", () => {
  let s = {
    ...createSimulation(5, () => 0.5),
    reviewMode: "selective",
    reviewOrders: [2],
  };
  for (let i = 0; i < 5; i++) {
    s = transitionSimulation(s, "reveal");
    s = transitionSimulation(s, "start");
    s = transitionSimulation(s, "submit");
    if (i === 1) {
      assert.equal(s.status, "review");
      assert.equal(s.completed, 1);
      s = transitionSimulation(s, "approve");
    }
    assert.equal(s.completed, i + 1);
  }
  assert.equal(s.status, "stage_review");
  let a = { ...createSimulation(5, () => 0.5), reviewMode: "automatic" };
  for (let i = 0; i < 5; i++) {
    a = transitionSimulation(a, "reveal");
    a = transitionSimulation(a, "start");
    a = transitionSimulation(a, "submit");
  }
  assert.equal(a.status, "settled");
});

test("community preview validates progress and credentials without changing legacy orders", () => {
  const s = createSimulation(5);
  const original = JSON.stringify(s.orders);
  s.community = { completed: 5, genre: "奇幻爱情", rating: 4, review: "剧情很有吸引力", shared: false, code: "ABCD2345" };
  assert.ok(validateSimulation(s));
  assert.equal(JSON.stringify(s.orders), original);
  for (const patch of [{completed:6}, {rating:99}, {code:"not-valid"}, {review:"x".repeat(501)}, {shared:"yes"}]) {
    assert.equal(validateSimulation({...s, community:{...s.community,...patch}}), false);
  }
});

test("standalone example quotes use inclusive cent and basis point ranges and validate rounding", async () => {
  const {createExampleQuote, validExampleQuote} = await import("../src/studio/stageSimulation.ts");
  assert.deepEqual(createExampleQuote(()=>0), {amount:27700,rate:250,commission:693});
  assert.deepEqual(createExampleQuote(()=>0.999999), {amount:29800,rate:380,commission:1132});
  for (const seed of [0,0.1,0.5,0.999999]) {
    const q=createExampleQuote(()=>seed);
    assert.ok(validExampleQuote(q));
    assert.equal(validExampleQuote({...q, commission:q.commission+1}),false);
    const s=createSimulation(5);
    s.community={completed:4,genre:"",rating:0,review:"",shared:false,code:"",exampleQuote:q};
    assert.ok(validateSimulation(s));
    assert.equal(validateSimulation({...s,community:{...s.community,exampleQuote:{...q,amount:29801}}}),false);
  }
  assert.throws(()=>createExampleQuote(()=>1));
});
