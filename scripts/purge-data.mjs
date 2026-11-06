// Clears all app data but keeps the table structures, the super admin and
// campus manager accounts (profiles, pending invitations and logins), the
// universities those campus managers belong to, and the `languages` lookup.
// Everything else goes: squads, students, memberships, weeks, imports, belt
// records, raw rows, import errors, mentor/student accounts, other
// invitations, audit logs, support tickets and the uploaded CSVs in storage.
// Deletes children before parents so no foreign key blocks it.
//
//   node scripts/purge-data.mjs                      dry run: counts only
//   node scripts/purge-data.mjs --apply "PURGE ALL"  really delete
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^"|"$/g, "")];
    }),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const apply = process.argv.includes("--apply") && process.argv.includes("PURGE ALL");
const BUCKET = "dojo-imports";
const KEEP_ROLES = ["super_admin", "campus_manager"];
const notKept = (query) => query.not("role", "in", `(${KEEP_ROLES.join(",")})`);

// Children first. Each step: table, the column used to match all rows, and
// an optional extra filter.
const steps = (keptUniversityIds) => [
  ["support_messages", "id", null, { optional: true }],
  ["support_tickets", "id", null, { optional: true }],
  ["import_errors", "import_id"],
  ["raw_import_rows", "import_id"],
  ["weekly_belt_records", "student_id"],
  ["imports", "id"],
  ["weeks", "id"],
  ["user_invitations", "email", notKept],
  ["student_memberships", "student_id"],
  ["profiles", "id", notKept],
  ["students", "id"],
  ["squads", "id"],
  [
    "universities",
    "id",
    keptUniversityIds.length
      ? (query) => query.not("id", "in", `(${keptUniversityIds.join(",")})`)
      : null,
  ],
  ["audit_logs", "id"],
];

async function count(table, filter, options = {}) {
  let query = db.from(table).select("*", { count: "exact", head: true });
  if (filter) query = filter(query);
  const { count: rows, error, status } = await query;
  if (error || status === 404) {
    if (options.optional) return "table not created";
    throw new Error(`${table}: ${error?.message ?? status}`);
  }
  return rows ?? 0;
}

const { data: kept, error: keptError } = await db
  .from("profiles")
  .select("id, full_name, role, university_id")
  .in("role", KEEP_ROLES);
if (keptError) throw keptError;
const { data: keptInvites, error: inviteError } = await db
  .from("user_invitations")
  .select("email, role, university_id")
  .in("role", KEEP_ROLES);
if (inviteError) throw inviteError;
const keepIds = new Set(kept.map((profile) => profile.id));
const keptUniversityIds = [
  ...new Set(
    [...kept, ...keptInvites].map((row) => row.university_id).filter(Boolean),
  ),
];
for (const role of KEEP_ROLES) {
  const people = kept.filter((profile) => profile.role === role);
  console.log(`Keeping ${people.length} ${role.replace("_", " ")}(s): ${people.map((p) => p.full_name ?? p.id).join(", ") || "none"}`);
}
console.log(`Keeping ${keptInvites.length} pending invitation(s) for those roles, and ${keptUniversityIds.length} universit${keptUniversityIds.length === 1 ? "y" : "ies"} they belong to`);
if (!kept.some((profile) => profile.role === "super_admin")) {
  console.log("No super admin found — refusing to run, you would be locked out.");
  process.exit(1);
}
const STEPS = steps(keptUniversityIds);

const authUsers = [];
for (let page = 1; ; page += 1) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  authUsers.push(...data.users);
  if (data.users.length < 1000) break;
}
const doomedUsers = authUsers.filter((user) => !keepIds.has(user.id));

const { data: files } = await db.storage.from(BUCKET).list("", { limit: 1000 });

console.log("\nRows to delete:");
for (const [table, , filter, options] of STEPS)
  console.log(`  ${table.padEnd(22)} ${await count(table, filter, options)}`);
console.log(`  ${"auth users".padEnd(22)} ${doomedUsers.length}`);
console.log(`  ${"storage (top level)".padEnd(22)} ${files?.length ?? 0} item(s) in "${BUCKET}"`);

if (!apply) {
  console.log('\nDry run only. To delete, run: node scripts/purge-data.mjs --apply "PURGE ALL"');
  process.exit(0);
}

console.log("\nDeleting…");
for (const [table, column, filter, options] of STEPS) {
  let query = db.from(table).delete({ count: "exact" }).not(column, "is", null);
  if (filter) query = filter(query);
  const { error, count: removed, status } = await query;
  if ((error || status === 404) && options?.optional) {
    console.log(`  ${table.padEnd(22)} skipped (table not created)`);
    continue;
  }
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`  ${table.padEnd(22)} ${removed ?? 0} deleted`);
}

for (const user of doomedUsers) {
  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) console.log(`  could not delete login ${user.email}: ${error.message}`);
}
console.log(`  ${"auth users".padEnd(22)} ${doomedUsers.length} deleted`);

// Uploaded CSVs live in nested folders; walk and remove every file.
async function walk(prefix) {
  const { data, error } = await db.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) return [];
  const paths = [];
  for (const item of data) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) paths.push(path);
    else paths.push(...(await walk(path)));
  }
  return paths;
}
const paths = await walk("");
for (let index = 0; index < paths.length; index += 100) {
  await db.storage.from(BUCKET).remove(paths.slice(index, index + 100));
}
console.log(`  ${"storage files".padEnd(22)} ${paths.length} deleted`);
console.log("\nDone. Super admins and campus managers can sign in and start fresh.");
