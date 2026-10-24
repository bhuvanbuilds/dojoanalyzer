import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/user-filters.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { applyUserFilters, presenceOf, EMPTY_FILTERS, activeFilterCount } = await import(
  `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`
);

const NOW = Date.parse("2026-10-24T12:00:00Z");
const u = (email, role, university_id, extra = {}) => ({
  email,
  full_name: email.split("@")[0],
  role,
  university_id,
  university_name: university_id,
  student_name: null,
  status: "active",
  last_seen_at: null,
  last_sign_in_at: "2026-10-01T00:00:00Z",
  ...extra,
});
const people = [
  u("asha@x.in", "mentor", "KARE"),
  u("bala@x.in", "student", "KARE"),
  u("chen@x.in", "campus_manager", "MIT"),
  u("dev@x.in", "student", "SRM"),
  u("eve@x.in", "super_admin", null),
  u("fay@x.in", "mentor", "MIT", { status: "pending", last_sign_in_at: null }),
];
const emails = (list) => list.map((user) => user.email);

test("several universities at once", () => {
  const out = applyUserFilters(people, { ...EMPTY_FILTERS, universities: ["KARE", "MIT"] }, NOW);
  assert.deepEqual(emails(out), ["asha@x.in", "bala@x.in", "chen@x.in", "fay@x.in"]);
});

test("'none' keeps people without a university", () => {
  assert.deepEqual(emails(applyUserFilters(people, { ...EMPTY_FILTERS, universities: ["none"] }, NOW)), ["eve@x.in"]);
});

test("exclude a single role", () => {
  const out = applyUserFilters(people, { ...EMPTY_FILTERS, roles: { student: "exclude" } }, NOW);
  assert.ok(out.every((user) => user.role !== "student"));
  assert.equal(out.length, 4);
});

test("include several roles, combined with universities", () => {
  const out = applyUserFilters(
    people,
    { ...EMPTY_FILTERS, universities: ["KARE", "MIT"], roles: { mentor: "include", campus_manager: "include" } },
    NOW,
  );
  assert.deepEqual(emails(out), ["asha@x.in", "chen@x.in", "fay@x.in"]);
});

test("presence: green recent, gray idle, red never signed in", () => {
  assert.equal(presenceOf(u("a@x", "mentor", null, { last_seen_at: "2026-10-24T11:58:00Z" }), NOW), "online");
  assert.equal(presenceOf(u("a@x", "mentor", null, { last_seen_at: "2026-10-24T10:00:00Z" }), NOW), "offline");
  assert.equal(presenceOf(people[5], NOW), "never");
  const out = applyUserFilters(people, { ...EMPTY_FILTERS, presence: ["never"] }, NOW);
  assert.deepEqual(emails(out), ["fay@x.in"]);
});

test("search matches name, email, campus and squad", () => {
  const withSquad = [...people, u("gita@x.in", "mentor", "VELS", { squads: [{ squad_number: "183" }] })];
  assert.deepEqual(emails(applyUserFilters(withSquad, { ...EMPTY_FILTERS, search: "183" }, NOW)), ["gita@x.in"]);
  assert.deepEqual(emails(applyUserFilters(people, { ...EMPTY_FILTERS, search: "srm" }, NOW)), ["dev@x.in"]);
});

test("sorting and filter count", () => {
  const byRole = applyUserFilters(people, { ...EMPTY_FILTERS, sort: "role" }, NOW);
  assert.equal(byRole[0].role, "super_admin");
  assert.equal(activeFilterCount({ ...EMPTY_FILTERS, search: "a", roles: { student: "exclude", mentor: "include" } }), 3);
});
