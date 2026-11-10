import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireRoles } from "@/lib/auth/authorization";
import { isUuid } from "@/lib/is-uuid";
import { loadCards, loadScopedStudents } from "@/lib/leetcode-server";
import { istDay } from "@/lib/leetcode";

const STAFF = ["mentor", "campus_manager", "super_admin"] as const;
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const addDays = (day: string, delta: number) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
};
/** "Mon, 10 Nov 2026" */
const nice = (day: string, options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", year: "numeric" }) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { ...options, timeZone: "UTC" });

const FILL = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFE4E4E7" } },
  bottom: { style: "thin", color: { argb: "FFE4E4E7" } },
  left: { style: "thin", color: { argb: "FFE4E4E7" } },
  right: { style: "thin", color: { argb: "FFE4E4E7" } },
};

/**
 * GET ?week=YYYY-MM-DD (any day in it)&university_id&squad_id: an Excel report of
 * who was active on LeetCode each day of that Monday–Sunday week, for the
 * students in the caller's scope. Active = at least one LeetCode submission.
 */
export async function GET(request: Request) {
  const authorization = await requireRoles(STAFF);
  if (authorization.response) return authorization.response;
  const params = new URL(request.url).searchParams;
  const asked = params.get("week");
  const anchor = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : istDay();
  const monday = addDays(anchor, -((new Date(`${anchor}T00:00:00Z`).getUTCDay() + 6) % 7));
  const days = DAY_NAMES.map((_, index) => addDays(monday, index));
  const today = istDay();

  const universityId = params.get("university_id");
  const squadId = params.get("squad_id");
  let students = await loadScopedStudents(authorization.profile, { universityId: isUuid(universityId) ? universityId : null });
  if (isUuid(squadId)) students = students.filter((student) => student.squad_id === squadId);
  students.sort((a, b) => a.squad_number.localeCompare(b.squad_number, undefined, { numeric: true }) || a.name.localeCompare(b.name));
  const cards = new Map((await loadCards(students)).map((card) => [card.student_id, card]));

  const book = new ExcelJS.Workbook();
  book.creator = "Dojo Belt Analyzer";
  const sheet = book.addWorksheet("LeetCode activity", { views: [{ state: "frozen", xSplit: 2, ySplit: 4 }] });
  const columns = 5 + days.length + 3;

  // Title rows.
  sheet.mergeCells(1, 1, 1, columns);
  const title = sheet.getCell(1, 1);
  title.value = `LeetCode weekly activity · ${nice(days[0], { day: "numeric", month: "short" })} – ${nice(days[6])}`;
  title.font = { bold: true, size: 15, color: { argb: "FFFFFFFF" } };
  title.fill = FILL("FF18181B");
  title.alignment = { vertical: "middle", indent: 1 };
  sheet.getRow(1).height = 30;
  sheet.mergeCells(2, 1, 2, columns);
  const sub = sheet.getCell(2, 1);
  sub.value = `Generated ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })} IST · Active = at least one LeetCode submission that day (12 am – 12 am)`;
  sub.font = { italic: true, size: 10, color: { argb: "FF71717A" } };
  sub.alignment = { indent: 1 };

  // Header.
  const header = ["Student", "Squad", "Campus", "Kalvium email", "LeetCode", ...days.map((day, index) => `${DAY_NAMES[index].slice(0, 3)}\n${nice(day, { day: "numeric", month: "short" })}`), "Active days", "Inactive days", "Inactive on"];
  const headerRow = sheet.getRow(4);
  headerRow.values = header;
  headerRow.height = 34;
  headerRow.eachCell((cell, column) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = FILL(column > 5 && column <= 5 + days.length ? "FFEF3837" : "FF27272A");
    cell.alignment = { vertical: "middle", horizontal: column > 5 ? "center" : "left", wrapText: true, indent: column > 5 ? 0 : 1 };
    cell.border = BORDER;
  });

  let rowIndex = 5;
  const totals = { inactiveStudents: 0, unlinked: 0 };
  for (const student of students) {
    const card = cards.get(student.id);
    const row = sheet.getRow(rowIndex++);
    const counted = days.filter((day) => day <= today);
    if (!card?.username) {
      totals.unlinked += 1;
      row.values = [student.name, student.squad_number, student.university_name ?? "", student.email ?? "", "Not linked", ...days.map(() => "—"), "—", "—", "LeetCode not linked"];
    } else {
      const inactive = counted.filter((day) => !((card.activity_days[day] ?? 0) > 0));
      if (inactive.length) totals.inactiveStudents += 1;
      row.values = [
        student.name,
        student.squad_number,
        student.university_name ?? "",
        student.email ?? "",
        card.username,
        ...days.map((day) => (day > today ? "" : (card.activity_days[day] ?? 0) > 0 ? `✓ ${card.activity_days[day]}` : "✗")),
        counted.length - inactive.length,
        inactive.length,
        inactive.map((day) => nice(day, { weekday: "short", day: "numeric", month: "short" })).join(", ") || "Active every day",
      ];
    }
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cell.border = BORDER;
      cell.alignment = { vertical: "middle", horizontal: column > 5 && column <= 5 + days.length + 2 ? "center" : "left", indent: column <= 5 ? 1 : 0, wrapText: column === columns };
      if (rowIndex % 2 === 0) cell.fill = FILL("FFFAFAFA");
      if (column === 1) cell.font = { bold: true };
      if (column > 5 && column <= 5 + days.length) {
        const value = String(cell.value ?? "");
        if (value.startsWith("✓")) {
          cell.fill = FILL("FFDCFCE7");
          cell.font = { bold: true, color: { argb: "FF15803D" } };
        } else if (value === "✗") {
          cell.fill = FILL("FFFEE2E2");
          cell.font = { bold: true, color: { argb: "FFB91C1C" } };
        }
      }
      if (column === 5 + days.length + 2 && Number(cell.value) > 0) cell.font = { bold: true, color: { argb: "FFB91C1C" } };
      if (!card?.username && column === 5) cell.font = { italic: true, color: { argb: "FF71717A" } };
    });
  }

  // Summary.
  rowIndex += 1;
  const summary = sheet.getRow(rowIndex);
  summary.values = [`${students.length} students · ${totals.inactiveStudents} missed at least one day · ${totals.unlinked} without LeetCode linked`];
  sheet.mergeCells(rowIndex, 1, rowIndex, columns);
  summary.getCell(1).font = { bold: true, color: { argb: "FF18181B" } };
  summary.getCell(1).fill = FILL("FFFEF3C7");

  sheet.columns.forEach((column, index) => {
    column.width = [24, 8, 12, 34, 18][index] ?? (index < 5 + days.length ? 11 : index === columns - 1 ? 40 : 12);
  });
  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: columns } };

  const buffer = await book.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="LeetCode activity ${monday}.xlsx"`,
    },
  });
}
