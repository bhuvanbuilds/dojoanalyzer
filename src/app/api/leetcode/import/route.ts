import { NextResponse } from "next/server";
import Papa from "papaparse";
import { requireRoles, writeAuditLog } from "@/lib/auth/authorization";
import { isUuid } from "@/lib/is-uuid";
import { loadScopedStudents, saveUsername } from "@/lib/leetcode-server";
import { cleanUsername } from "@/lib/leetcode";

const STAFF = ["mentor", "campus_manager", "super_admin"] as const;

/**
 * POST { csv, universityId? }: bulk-links LeetCode usernames. The CSV needs an
 * email column and a username column (leetcode / leetcode_username /
 * username / profile link). Only students in the caller's scope are updated.
 */
export async function POST(request: Request) {
  const authorization = await requireRoles(STAFF);
  if (authorization.response) return authorization.response;
  if (authorization.profile.viewing_as) return NextResponse.json({ error: "View as is read-only" }, { status: 403 });
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const csv = typeof body.csv === "string" ? body.csv : "";
    if (!csv.trim() || csv.length > 500_000) return NextResponse.json({ error: "Upload a CSV file (under 500 KB)" }, { status: 400 });
    const parsed = Papa.parse<Record<string, string>>(csv.trim(), {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase().replace(/[\s-]+/g, "_"),
    });
    const fields = parsed.meta.fields ?? [];
    const emailKey = fields.find((field) => field.includes("email"));
    const userKey = ["leetcode_username", "leetcode", "username", "leetcode_profile", "profile", "link", "url"].find((key) =>
      fields.includes(key),
    );
    if (!emailKey || !userKey)
      return NextResponse.json({ error: "The CSV needs an email column and a leetcode_username column" }, { status: 400 });

    const universityId = isUuid(body.universityId) ? (body.universityId as string) : null;
    const students = await loadScopedStudents(authorization.profile, { universityId });
    const byEmail = new Map(students.filter((student) => student.email).map((student) => [student.email!.toLowerCase(), student]));

    let linked = 0;
    const problems: string[] = [];
    for (const [index, row] of parsed.data.entries()) {
      const email = (row[emailKey] ?? "").trim().toLowerCase();
      const raw = (row[userKey] ?? "").trim();
      if (!email && !raw) continue;
      const student = byEmail.get(email);
      const username = cleanUsername(raw);
      if (!student) problems.push(`Row ${index + 2}: no student with ${email || "that email"} in your scope`);
      else if (!username) problems.push(`Row ${index + 2}: "${raw}" isn’t a LeetCode username`);
      else {
        const problem = await saveUsername(student.id, username, authorization.user.id);
        if (problem) problems.push(`Row ${index + 2}: ${problem}`);
        else linked += 1;
      }
    }
    await writeAuditLog(authorization.user.id, "leetcode_usernames_imported", "student", null, { linked, problems: problems.length });
    return NextResponse.json({ linked, problems: problems.slice(0, 50) });
  } catch (error) {
    console.error("LeetCode import error:", error);
    return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
  }
}
