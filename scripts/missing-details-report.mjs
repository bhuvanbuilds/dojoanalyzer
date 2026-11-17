// Excel list of active students missing primary/secondary language, LeetCode,
// GitHub, LinkedIn or personal email. Run: node scripts/missing-details-report.mjs
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
import { readFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const one = (v) => (Array.isArray(v) ? v[0] : v) ?? null;

const { data: members, error } = await db
  .from("student_memberships")
  .select("students!inner(id, name, email, primary_language, secondary_language, personal_email), squads!inner(squad_number, universities(name, display_name))")
  .is("end_date", null);
if (error) throw error;
const ids = members.map((m) => one(m.students).id);
const [{ data: lc }, { data: links }] = await Promise.all([
  db.from("leetcode_accounts").select("student_id, username").in("student_id", ids),
  db.from("student_links").select("student_id, github_url, linkedin_url").in("student_id", ids),
]);
const lcBy = new Map(lc.map((r) => [r.student_id, r.username]));
const linkBy = new Map(links.map((r) => [r.student_id, r]));
const LANG = { cpp: "C++", java: "Java", nodejs: "Node.js", python: "Python" };

const rows = members
  .map((m) => {
    const s = one(m.students);
    const q = one(m.squads);
    const u = one(q.universities);
    const l = linkBy.get(s.id);
    return {
      campus: u?.display_name || u?.name || "",
      squad: String(q.squad_number),
      name: s.name.replace(/\s+/g, " ").trim(),
      email: s.email,
      primary: LANG[s.primary_language] ?? null,
      secondary: LANG[s.secondary_language] ?? null,
      leetcode: lcBy.get(s.id) ?? null,
      github: l?.github_url ?? null,
      linkedin: l?.linkedin_url ?? null,
      personal: s.personal_email ?? null,
    };
  })
  .filter((r) => !r.primary || !r.secondary || !r.leetcode || !r.github || !r.linkedin)
  .sort((a, b) => a.campus.localeCompare(b.campus) || a.squad.localeCompare(b.squad, undefined, { numeric: true }) || a.name.localeCompare(b.name));

const book = new ExcelJS.Workbook();
const sheet = book.addWorksheet("Missing details", { views: [{ state: "frozen", xSplit: 3, ySplit: 4 }] });
const headers = ["Campus", "Squad", "Student", "Kalvium email", "Primary language", "Secondary language", "LeetCode", "GitHub", "LinkedIn", "Personal email", "Missing"];
const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const border = { top: { style: "thin", color: { argb: "FFE4E4E7" } }, bottom: { style: "thin", color: { argb: "FFE4E4E7" } }, left: { style: "thin", color: { argb: "FFE4E4E7" } }, right: { style: "thin", color: { argb: "FFE4E4E7" } } };

sheet.mergeCells(1, 1, 1, headers.length);
Object.assign(sheet.getCell(1, 1), { value: "Students with missing details" });
sheet.getCell(1, 1).font = { bold: true, size: 15, color: { argb: "FFFFFFFF" } };
sheet.getCell(1, 1).fill = fill("FF18181B");
sheet.getRow(1).height = 30;
sheet.mergeCells(2, 1, 2, headers.length);
sheet.getCell(2, 1).value = `Generated ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })} IST · ${rows.length} students · red = missing`;
sheet.getCell(2, 1).font = { italic: true, size: 10, color: { argb: "FF71717A" } };

const header = sheet.getRow(4);
header.values = headers;
header.height = 26;
header.eachCell((cell, col) => {
  cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cell.fill = fill(col >= 5 && col <= 9 ? "FFEF3837" : "FF27272A");
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = border;
});

rows.forEach((r, index) => {
  const missing = [!r.primary && "Primary", !r.secondary && "Secondary", !r.leetcode && "LeetCode", !r.github && "GitHub", !r.linkedin && "LinkedIn"].filter(Boolean);
  const row = sheet.getRow(5 + index);
  row.values = [r.campus, r.squad, r.name, r.email, r.primary ?? "Missing", r.secondary ?? "Missing", r.leetcode ?? "Missing", r.github ? { text: "GitHub", hyperlink: r.github } : "Missing", r.linkedin ? { text: "LinkedIn", hyperlink: r.linkedin } : "Missing", r.personal ?? "—", missing.join(", ")];
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    cell.border = border;
    cell.alignment = { vertical: "middle", horizontal: col === 2 || (col >= 5 && col <= 9) ? "center" : "left" };
    if (index % 2) cell.fill = fill("FFFAFAFA");
    if (col === 3) cell.font = { bold: true };
    if (cell.value === "Missing") {
      cell.fill = fill("FFFEE2E2");
      cell.font = { bold: true, color: { argb: "FFB91C1C" } };
    } else if (col >= 5 && col <= 9) {
      cell.fill = fill("FFDCFCE7");
      cell.font = { color: { argb: "FF15803D" }, underline: col >= 8 };
    }
  });
});

[10, 8, 30, 40, 14, 14, 20, 11, 11, 30, 40].forEach((w, i) => (sheet.getColumn(i + 1).width = w));
sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: headers.length } };

// Per-campus summary.
const summary = book.addWorksheet("Summary");
summary.getRow(1).values = ["Campus", "Students listed", "No primary", "No secondary", "No LeetCode", "No GitHub", "No LinkedIn"];
summary.getRow(1).eachCell((c) => {
  c.font = { bold: true, color: { argb: "FFFFFFFF" } };
  c.fill = fill("FF27272A");
});
const campuses = [...new Set(rows.map((r) => r.campus))];
campuses.forEach((campus, i) => {
  const list = rows.filter((r) => r.campus === campus);
  summary.getRow(i + 2).values = [campus, list.length, list.filter((r) => !r.primary).length, list.filter((r) => !r.secondary).length, list.filter((r) => !r.leetcode).length, list.filter((r) => !r.github).length, list.filter((r) => !r.linkedin).length];
});
summary.columns.forEach((c) => (c.width = 16));

mkdirSync(new URL("../reports/", import.meta.url), { recursive: true });
const out = new URL(`../reports/Missing student details ${new Date().toISOString().slice(0, 10)}.xlsx`, import.meta.url);
await book.xlsx.writeFile(out);
console.log(`${rows.length} students →`, decodeURIComponent(out.pathname.replace(/^\//, "")));
campuses.forEach((c) => console.log(c, rows.filter((r) => r.campus === c).length));
