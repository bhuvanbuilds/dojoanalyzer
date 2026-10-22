import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/earned-belts.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { keepEarnedBelts } = await import(
  `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`
);

const rec = (student_id, week, levels) => ({ student_id, week, final_belt_levels: levels });

test("a lower later level keeps the earlier belt", () => {
  const out = keepEarnedBelts(
    [
      rec("a", 3, { cpp: 0, java: 0, nodejs: 0, python: 2 }),
      rec("a", 2, { cpp: 0, java: 0, nodejs: 0, python: 3 }),
    ],
    (r) => r.week,
  );
  // Original order kept; week 3 raised to week 2's 3.
  assert.equal(out[0].final_belt_levels.python, 3);
  assert.equal(out[1].final_belt_levels.python, 3);
});

test("students and languages are independent", () => {
  const out = keepEarnedBelts(
    [
      rec("a", 1, { cpp: 2, java: 0, nodejs: 0, python: 0 }),
      rec("b", 2, { cpp: 0, java: 0, nodejs: 0, python: 0 }),
      rec("a", 2, { cpp: 1, java: 1, nodejs: 0, python: 0 }),
    ],
    (r) => r.week,
  );
  assert.deepEqual(out[2].final_belt_levels, { cpp: 2, java: 1, nodejs: 0, python: 0 });
  assert.equal(out[1].final_belt_levels.cpp, 0);
});

test("normal progress is unchanged and inputs are not mutated", () => {
  const input = [rec("a", 1, { python: 1 }), rec("a", 2, { python: 2 })];
  const out = keepEarnedBelts(input, (r) => r.week);
  assert.equal(out[1].final_belt_levels.python, 2);
  assert.equal(input[0].final_belt_levels.python, 1);
});
