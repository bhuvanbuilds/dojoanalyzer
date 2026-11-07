import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/gamification.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const g = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);

test("points by difficulty", () => {
  assert.equal(g.pointsFor("Easy"), 10);
  assert.equal(g.pointsFor("Medium"), 25);
  assert.equal(g.pointsFor("Hard"), 50);
  assert.equal(g.pointsFor(null), 10);
  assert.equal(g.lifetimePoints(13, 32, 6), 13 * 10 + 32 * 25 + 6 * 50);
});

test("longest run of consecutive days", () => {
  assert.equal(g.longestRun(["2026-11-01", "2026-11-02", "2026-11-04", "2026-11-05", "2026-11-06"]), 3);
  assert.equal(g.longestRun([]), 0);
  assert.equal(g.longestRun(["2026-10-31", "2026-11-01"]), 2);
});

test("achievements unlock from real activity", () => {
  // 7 consecutive IST days, one at 7 am IST (01:30 UTC), one at 11:30 pm IST (18:00 UTC).
  const solves = Array.from({ length: 7 }, (_, index) => ({
    solved_at: `2026-11-0${index + 1}T10:00:00Z`,
    difficulty: "Medium",
  }));
  solves.push({ solved_at: "2026-11-03T01:30:00Z", difficulty: "Easy" }, { solved_at: "2026-11-03T18:00:00Z", difficulty: "Hard" });
  const list = g.achievements({ totals: { all: 51, easy: 13, medium: 32, hard: 6 }, solves, dailyDays: ["2026-11-06"] });
  const has = (id) => list.find((item) => item.id === id).unlocked;
  assert.ok(has("first-solve") && has("daily-first") && has("solved-50") && has("first-hard"));
  assert.ok(has("streak-7") && has("early-bird") && has("night-owl") && has("busy-day"));
  // Nov 7-8 2026 is a weekend; Nov 7 is a Saturday with a solve but no Sunday solve.
  assert.ok(!has("weekend"));
  assert.ok(!has("solved-100") && !has("daily-7"));
  assert.equal(list.find((item) => item.id === "solved-100").progress, 51);
});
