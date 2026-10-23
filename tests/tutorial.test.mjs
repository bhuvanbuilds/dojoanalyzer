import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");

const source = read("src/lib/tutorial/config.ts");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const config = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
const { TOURS, TOUR_IDS, tutorialRoleFor, pageMatches, nextPageIndex, firstStepOn, CSV_DEMO_STAGES } = config;

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(tsx?|mjs)$/.test(name) ? [path] : [];
  });
}
const allSource = files(join(root, "src"))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

test("only students, mentors, campus managers and super admins get a tour", () => {
  assert.deepEqual(Object.keys(TOURS).sort(), ["campus_manager", "mentor", "student", "super_admin"]);
  assert.equal(tutorialRoleFor({ role: "super_admin", is_developer: true }), null);
  assert.equal(tutorialRoleFor({ role: null }), null);
  assert.equal(tutorialRoleFor({ role: "mentor" }), "mentor");
  assert.equal(tutorialRoleFor({ role: "super_admin", is_developer: false }), "super_admin");
});

test("View as uses the viewed role's tour", () => {
  assert.equal(tutorialRoleFor({ role: "super_admin", is_developer: true, viewing_as: { role: "student" } }), "student");
  assert.equal(tutorialRoleFor({ role: "super_admin", is_developer: true, viewing_as: { role: "campus_manager" } }), "campus_manager");
});

test("tour ids are versioned and distinct", () => {
  const ids = Object.values(TOUR_IDS);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /-v\d+$/);
});

test("step ids are unique within each tour", () => {
  for (const steps of Object.values(TOURS)) {
    const ids = steps.map((step) => step.id);
    assert.equal(new Set(ids).size, ids.length);
  }
});

test("page matching handles dynamic segments and wildcards", () => {
  assert.ok(pageMatches("/imports/[id]", "/imports/abc-123"));
  assert.ok(!pageMatches("/imports/[id]", "/imports"));
  assert.ok(pageMatches("/", "/"));
  assert.ok(!pageMatches("/", "/leaderboard"));
  assert.ok(pageMatches("/leaderboard", "/leaderboard/"));
  assert.ok(!pageMatches("/leaderboard", "/leaderboard/language"));
  assert.ok(pageMatches("*", "/anything"));
});

test("skip this page jumps past the current page's run of steps", () => {
  const steps = TOURS.mentor;
  const first = steps.findIndex((step) => step.page === "/");
  const after = nextPageIndex(steps, first);
  assert.notEqual(steps[after].page, "/");
  assert.ok(steps.slice(first, after).every((step) => step.page === "/"));
  assert.equal(firstStepOn(steps, "/analytics"), steps.findIndex((step) => step.page === "/analytics"));
  assert.equal(firstStepOn(steps, "/users"), -1);
});

test("role boundaries: staff-only pages never appear in lower roles' tours", () => {
  const pages = (role) => new Set(TOURS[role].map((step) => step.page));
  for (const page of ["/", "/students", "/imports", "/weekly-comparison", "/analytics"]) assert.ok(!pages("student").has(page));
  for (const page of ["/students", "/imports", "/universities", "/users", "/audit-logs", "/support/inbox"])
    assert.ok(!pages("mentor").has(page));
  for (const page of ["/universities", "/users", "/audit-logs", "/support/inbox"]) assert.ok(!pages("campus_manager").has(page));
});

test("every consequential control is click-guarded, never a plain click step", () => {
  const consequential = new Set([
    "ar-approve", "ar-reject", "users-delete", "users-edit", "uni-rename", "uni-save",
    "st-new-squad", "st-add-student", "tk-internal", "tk-assignee", "tk-status", "tk-severity", "tk-changelog",
  ]);
  for (const steps of Object.values(TOURS))
    for (const step of steps)
      if (step.target.some((target) => consequential.has(target)))
        assert.equal(step.action, "guarded", `${step.id} targets a consequential control`);
});

test("every data-tour target used by a tour exists in the code", () => {
  const dynamic = { "chart-tab-movement": "data-tour={`chart-tab-${slide.key}`}", "st-monitor": '"st-monitor"', "st-collection": '"st-collection"' };
  for (const steps of Object.values(TOURS))
    for (const step of steps)
      for (const target of step.target) {
        if (target.startsWith("css:")) continue;
        const marker = dynamic[target] ?? null;
        const found = marker
          ? allSource.includes(marker)
          : allSource.includes(`data-tour="${target}"`) || allSource.includes(`tour="${target}"`) || allSource.includes(`tour: "${target}"`);
        assert.ok(found, `${step.id}: no element marked "${target}"`);
      }
});

test("the CSV demo never calls the import API", () => {
  const ui = read("src/components/tutorial/tutorial.tsx");
  const fetches = [...ui.matchAll(/fetch\(\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.ok(fetches.length > 0);
  for (const url of fetches) assert.equal(url, "/api/tutorial");
  assert.ok(!ui.includes("/api/import"));
  assert.ok(!ui.includes("CsvUploadDialog"));
  assert.equal(CSV_DEMO_STAGES.length, 9);
});

test("progress API trusts only the session for the user id", () => {
  const route = read("src/app/api/tutorial/route.ts");
  assert.match(route, /getCurrentUserProfile/);
  assert.ok(!/body\.user_?id|body\.userId/i.test(route));
  assert.match(route, /status: 401/);
  assert.match(route, /ALL_TOUR_IDS\.includes\(body\.tour\)/);
});

test("Remind me later never records completion", () => {
  const ui = read("src/components/tutorial/tutorial.tsx");
  const remind = ui.slice(ui.indexOf("const remindLater"), ui.indexOf("const next = useCallback"));
  assert.ok(remind.length > 0);
  assert.ok(!remind.includes("record("));
});
