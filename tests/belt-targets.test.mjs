import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/belt-targets.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const t = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);

const L = (cpp, java, nodejs, python) => ({ cpp, java, nodejs, python });

test("total target counts belts gained across languages", () => {
  const p = t.targetProgress({ total_gain: 3, language_gains: null }, L(1, 1, 1, 1), L(2, 1, 3, 1));
  assert.deepEqual([p.goal, p.gained, p.done], [3, 3, true]);
  const q = t.targetProgress({ total_gain: 3, language_gains: null }, L(1, 1, 1, 1), L(1, 2, 1, 1));
  assert.deepEqual([q.gained, q.done], [1, false]);
});

test("per-language target needs each language met and caps extra gains", () => {
  const target = { total_gain: null, language_gains: { java: 1, python: 2 } };
  const p = t.targetProgress(target, L(0, 2, 0, 1), L(5, 4, 0, 2));
  // Java +2 counts as 1 (capped); Python +1 of 2; C++ gains don't count.
  assert.deepEqual([p.goal, p.gained, p.done], [3, 2, false]);
  assert.deepEqual(p.languages.map((item) => item.language), ["java", "python"]);
});

test("belts never count as lost", () => {
  const p = t.targetProgress({ total_gain: 2, language_gains: null }, L(3, 3, 3, 3), L(2, 3, 3, 3));
  assert.equal(p.gained, 0);
});

test("month helpers and input cleaning", () => {
  assert.equal(t.parseMonth("2026-11"), "2026-11-01");
  assert.equal(t.parseMonth("2026-11-01"), "2026-11-01");
  assert.equal(t.parseMonth("2026-13"), null);
  assert.equal(t.monthKey(new Date(2026, 10, 17)), "2026-11-01");
  assert.equal(t.daysLeft("2026-11-01", new Date(2026, 10, 30)), 1);
  assert.deepEqual(t.cleanLanguageGains({ java: "2", cpp: 0, python: -1, rust: 3 }), { java: 2 });
  assert.equal(t.cleanLanguageGains({ java: 0 }), null);
  assert.equal(t.describeTarget({ total_gain: 1, language_gains: null }), "Gain 1 belt");
  assert.equal(t.describeTarget({ total_gain: null, language_gains: { java: 1, python: 2 } }), "Java +1 · Python +2");
});
