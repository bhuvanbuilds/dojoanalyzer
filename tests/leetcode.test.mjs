import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/leetcode.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const l = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);

test("usernames: bare, @, and profile links", () => {
  assert.equal(l.cleanUsername("lee215"), "lee215");
  assert.equal(l.cleanUsername("  @prem_s-01 "), "prem_s-01");
  assert.equal(l.cleanUsername("https://leetcode.com/u/prem_s/"), "prem_s");
  assert.equal(l.cleanUsername("leetcode.com/prem_s"), "prem_s");
  assert.equal(l.cleanUsername("bad name!"), null);
  assert.equal(l.cleanUsername(""), null);
});

test("days run 12 am to 12 am India time", () => {
  // 18:29 UTC is 23:59 IST the same day; 18:30 UTC is 00:00 IST the next day.
  assert.equal(l.istDay(Date.UTC(2026, 10, 6, 18, 29)), "2026-11-06");
  assert.equal(l.istDay(Date.UTC(2026, 10, 6, 18, 30)), "2026-11-07");
});

test("first sync: earlier days are the starting point, today's first solves count", () => {
  const today = "2026-11-06";
  const todayAt = Date.UTC(2026, 10, 6, 13, 51); // 7:21 pm IST
  const out = l.creditNewSolves(
    [
      { slug: "old", title: "", at: Date.UTC(2026, 10, 5, 9, 0) },
      { slug: "new-today", title: "", at: todayAt, firstAt: todayAt },
      // Accepted today, but also accepted on an earlier day: a re-solve.
      { slug: "resolve", title: "", at: todayAt, firstAt: Date.UTC(2026, 10, 1) },
    ],
    null,
    51,
    today,
  );
  assert.deepEqual(
    out.map((item) => [item.slug, item.counted]),
    [
      ["new-today", true],
      ["resolve", false],
      ["old", false],
    ],
  );
});

test("only as many new solves as the total grew, newest first", () => {
  const fresh = [
    { slug: "old-resolve", title: "", at: 100 },
    { slug: "new-1", title: "", at: 300 },
    { slug: "new-2", title: "", at: 200 },
  ];
  // Total went 40 → 42: two new problems; the re-solve of an old one doesn't count.
  const out = l.creditNewSolves(fresh, 40, 42);
  assert.deepEqual(
    out.map((item) => [item.slug, item.counted]),
    [
      ["new-1", true],
      ["new-2", true],
      ["old-resolve", false],
    ],
  );
  // Total unchanged: a failed problem retried and accepted would raise it, so nothing new here.
  assert.equal(l.creditNewSolves(fresh, 42, 42).filter((item) => item.counted).length, 0);
});

test("solve streak counts back from today, or from yesterday before today's first solve", () => {
  const days = { "2026-11-04": 1, "2026-11-05": 2, "2026-11-06": 1 };
  assert.equal(l.solveStreak(days, "2026-11-06"), 3);
  assert.equal(l.solveStreak(days, "2026-11-07"), 3);
  assert.equal(l.solveStreak(days, "2026-11-08"), 0);
});

test("LeetCode calendar keys become days; status colours", () => {
  assert.deepEqual(l.calendarDays({ 1793923200: 3, bad: 1, 1793836800: 0 }), { "2026-11-06": 3 });
  assert.equal(l.cardStatus({ username: null, solved_today: 0 }), "missing");
  assert.equal(l.cardStatus({ username: "x", solved_today: 0 }), "pending");
  assert.equal(l.cardStatus({ username: "x", solved_today: 2 }), "solved");
});
