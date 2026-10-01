import test from "node:test";
import assert from "node:assert/strict";
import {
  positionSize,
  expectancy,
  emptyStore,
  emptyProfile,
  validateStore,
  reviewError,
  recordAttempt,
  confirmedSwings,
  aggregate,
  zoneAccepted,
  viennaDay,
  shuffle,
  learningRhythm,
} from "../src/academy/logic.mjs";
import { lessons, questions } from "../src/academy/content.ts";
const ids = new Set(questions.map((q) => q.id));

test("learning rhythm totals short sessions and preserves the last series after a break", () => {
  assert.deepEqual(
    learningRhythm([
      { date: "2026-10-01", seconds: 30 },
      { date: "2026-10-01", seconds: 30 },
      { date: "2026-10-02", seconds: 70 },
    ]),
    { days: ["2026-10-01", "2026-10-02"], streak: 2 },
  );
  assert.equal(
    learningRhythm([
      { date: "2026-09-01", seconds: 60 },
      { date: "2026-10-01", seconds: 60 },
    ]).streak,
    1,
  );
});

test("all 14 lessons have eight unique explained questions and complete content", () => {
  assert.equal(lessons.length, 14);
  assert.equal(questions.length, 112);
  assert.equal(ids.size, 112);
  for (const l of lessons) {
    assert.equal(l.quiz.length, 8);
    assert.ok(l.sections.length >= 3);
    assert.ok(l.goals.length >= 2);
    for (const key of [
      "example",
      "task",
      "solution",
      "mistakes",
      "summary",
      "extension",
    ])
      assert.ok(l[key].length > 0);
    for (const q of l.quiz) {
      assert.equal(q.day, l.day);
      assert.ok(q.explanation.length > 20);
      assert.equal(new Set(q.options).size, 3);
      assert.ok(q.options.includes(q.correct));
    }
  }
});
test("position sizing independently calculated including fixed and size dependent costs", () => {
  assert.deepEqual(
    positionSize({
      budget: 50,
      stop: 8,
      point: 2,
      fixed: 2,
      variable: 1,
      step: 1,
    }),
    { quantity: 2, risk: 32, costs: 4, total: 36, unused: 14 },
  );
  const r = positionSize({
    budget: 30,
    stop: 5,
    point: 2,
    fixed: 2,
    variable: 1,
    step: 1,
  });
  assert.equal(r.quantity, 2);
  assert.equal(r.total, 24);
  const fractional = positionSize({
    budget: 10,
    stop: 3,
    point: 2,
    fixed: 1,
    variable: 1,
    step: 0.1,
  });
  assert.equal(fractional.quantity, 1.2);
  assert.ok(Math.abs(fractional.total - 9.4) < 1e-10);
});
test("no volume is invented when a minimum step exceeds budget", () => {
  assert.match(
    positionSize({
      budget: 5,
      stop: 8,
      point: 2,
      fixed: 2,
      variable: 1,
      step: 1,
    }).error,
    /Keine Position/,
  );
  for (const invalid of [0, -1, NaN, Infinity])
    assert.ok(
      positionSize({
        budget: 50,
        stop: invalid,
        point: 2,
        fixed: 2,
        variable: 1,
        step: 1,
      }).error,
    );
  assert.ok(
    positionSize({
      budget: 50,
      stop: 3,
      point: 2,
      fixed: -2,
      variable: 1,
      step: 1,
    }).error,
  );
});
test("sizing never exceeds the budget over a varied input grid", () => {
  for (const budget of [1, 10, 30, 50, 100, 250])
    for (const stop of [0.5, 2, 8, 15])
      for (const step of [0.01, 0.1, 1, 2]) {
        const r = positionSize({
          budget,
          stop,
          point: 2,
          fixed: 2,
          variable: 1,
          step,
        });
        if (!r.error) {
          assert.ok(r.total <= budget + 1e-7);
          assert.ok(r.total + (stop * 2 + 1) * step > budget - 1e-7);
        }
      }
});
test("net expectancy with consistent costs and bounded probability", () => {
  assert.ok(
    Math.abs(expectancy({ rate: 40, win: 100, loss: 50, cost: 5 }) - 5) < 1e-10,
  );
  assert.equal(expectancy({ rate: 50, win: 80, loss: 40, cost: 4 }), 16);
  assert.equal(expectancy({ rate: 20, win: 150, loss: 50, cost: 0 }), -10);
  assert.equal(expectancy({ rate: 101, win: 80, loss: 40, cost: 4 }), null);
  assert.equal(expectancy({ rate: 50, win: NaN, loss: 40, cost: 4 }), null);
});
test("profile data is isolated, serializable and validated", () => {
  const state = emptyStore();
  state.profiles.Patrik.read.push(1);
  assert.deepEqual(state.profiles.Fabian.read, []);
  const restored = validateStore(JSON.parse(JSON.stringify(state)), ids);
  assert.deepEqual(restored, state);
  restored.profiles.Patrik.read.push(2);
  assert.equal(state.profiles.Patrik.read.length, 1);
  assert.throws(() => validateStore({ ...state, version: 2 }, ids));
  assert.throws(() => validateStore({ ...state, active: "Unknown" }, ids));
  assert.throws(() => validateStore({ ...state, profiles: {} }, ids));
  const invalid = emptyStore();
  invalid.profiles.Fabian.read = [15];
  assert.throws(() => validateStore(invalid, ids));
});
test("graded wrong answers become unique personal spaced reviews", () => {
  const q = questions[0],
    map = new Map(questions.map((q) => [q.id, q]));
  const a = {
    id: "day-1",
    label: "Tag 1",
    at: 100,
    score: 0,
    answers: [{ id: q.id, answer: q.options[1], correct: false }],
  };
  const p = recordAttempt(emptyProfile(), a, map);
  assert.equal(p.errors.length, 1);
  assert.equal(p.errors[0].due, 86400100);
  assert.equal(recordAttempt(p, a, map).errors.length, 1);
  let e = reviewError(p.errors[0], true, 200);
  assert.equal(e.stage, 1);
  assert.equal(e.due, 200 + 3 * 86400000);
  e = reviewError(e, true, 300);
  assert.equal(e.stage, 2);
  assert.equal(e.due, 300 + 7 * 86400000);
  assert.equal(reviewError(e, true, 400).resolved, true);
  assert.equal(reviewError(e, false, 400).stage, 0);
});
test("malformed results, bad practice IDs and invalid notes cannot be imported", () => {
  const s = emptyStore();
  s.profiles.Patrik.practice.push({
    id: "fake",
    passed: true,
    at: 1,
    variant: 0,
  });
  assert.throws(() => validateStore(s, ids));
  const t = emptyStore();
  t.profiles.Patrik.attempts.push({
    id: "day-1",
    label: "test",
    at: 1,
    score: 100,
    answers: [{ id: "d1-q1", answer: "x", correct: false }],
  });
  assert.throws(() => validateStore(t, ids));
  const n = emptyStore();
  n.profiles.Patrik.notes.push({
    id: "x",
    date: "bad",
    topic: "x",
    insight: "x",
    mistake: "",
    next: "",
  });
  assert.throws(() => validateStore(n, ids));
});
test("swings require two visible closed candles on each side", () => {
  const data = [1, 2, 5, 3, 2, 4, 7].map((h) => ({
    o: h - 1,
    h,
    l: h - 2,
    c: h - 0.5,
  }));
  assert.deepEqual(confirmedSwings(data), [
    { index: 2, type: "high" },
    { index: 4, type: "low" },
  ]);
  assert.deepEqual(confirmedSwings(data.slice(0, 4)), []);
  assert.ok(!confirmedSwings(data).some((s) => s.index === 6));
});
test("aggregation preserves first open, max high, min low and last close", () => {
  assert.deepEqual(
    aggregate(
      [
        { o: 100, h: 104, l: 99, c: 103 },
        { o: 103, h: 106, l: 101, c: 102 },
      ],
      2,
    ),
    [{ o: 100, h: 106, l: 99, c: 102 }],
  );
});
test("zone grading accepts multiple plausible bounded interpretations", () => {
  assert.equal(zoneAccepted(99, 101, 99, 101), true);
  assert.equal(zoneAccepted(98, 102, 99, 101), true);
  assert.equal(zoneAccepted(101, 99, 99, 101), false);
  assert.equal(zoneAccepted(90, 110, 99, 101), false);
  assert.equal(zoneAccepted(100, 100, 99, 101), false);
});
test("Vienna dates honor daylight saving and shuffling preserves options", () => {
  assert.equal(viennaDay(new Date("2026-10-01T22:30:00Z")), "2026-10-02");
  assert.equal(viennaDay(new Date("2026-12-01T22:30:00Z")), "2026-12-01");
  assert.deepEqual(shuffle([1, 2, 3]).sort(), [1, 2, 3]);
});
