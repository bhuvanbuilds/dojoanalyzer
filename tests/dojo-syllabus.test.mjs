import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/dojo-syllabus.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const s = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);

test("ten belts in order, each with topics and problems", () => {
  assert.deepEqual(
    s.SYLLABUS.map((belt) => belt.name),
    ["Yellow", "Orange", "Green", "Purple", "Blue", "Brown", "Sr. Brown", "Red", "Sr. Red", "Black"],
  );
  for (const belt of s.SYLLABUS) {
    assert.ok(belt.topics.length > 0, belt.name);
    for (const topic of belt.topics) assert.ok(topic.problems.length > 0, `${belt.name} · ${topic.name}`);
  }
});

test("without LeetCode data, syllabus order stays and nothing is weak", () => {
  const plans = s.planTopics(s.beltByLevel(4), null, new Set());
  assert.equal(plans[0].name, "Prefix & suffix sums");
  assert.ok(plans.every((plan) => !plan.weak && plan.tagSolved === null));
});

test("weakest topics come first and solved problems are marked", () => {
  const counts = { "prefix-sum": 9, "hash-table": 20, array: 30, "sliding-window": 0, "two-pointers": 5, "binary-search": 12, sorting: 4 };
  const plans = s.planTopics(s.beltByLevel(4), counts, new Set(["maximum-average-subarray-i"]));
  assert.equal(plans[0].name, "Sliding window");
  assert.equal(plans[0].weak, true);
  assert.equal(plans[0].problems[0].solved, true);
  // Today's pick skips the solved one.
  assert.equal(s.pickProblem(plans).problem.slug, "longest-substring-without-repeating-characters");
});
