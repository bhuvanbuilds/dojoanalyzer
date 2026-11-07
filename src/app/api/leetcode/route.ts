import { NextResponse } from "next/server";
import { requireRoles, writeAuditLog } from "@/lib/auth/authorization";
import { isUuid } from "@/lib/is-uuid";
import { loadCards, loadScopedStudents, saveUsername, syncStale } from "@/lib/leetcode-server";
import { cleanUsername } from "@/lib/leetcode";

const STAFF = ["mentor", "campus_manager", "super_admin"] as const;
const FAILED = () => NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
const missingTable = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: string }).code === "42P01";

/**
 * GET ?university_id=…&sync=1: LeetCode cards for the students in scope.
 * With sync=1 it first refreshes accounts not synced in the last 10 minutes.
 */
export async function GET(request: Request) {
  const authorization = await requireRoles(STAFF);
  if (authorization.response) return authorization.response;
  try {
    const params = new URL(request.url).searchParams;
    const universityId = params.get("university_id");
    const students = await loadScopedStudents(authorization.profile, { universityId: isUuid(universityId) ? universityId : null });
    if (params.get("sync") === "1") await syncStale(students.map((student) => student.id));
    return NextResponse.json({ cards: await loadCards(students) });
  } catch (error) {
    if (missingTable(error)) return NextResponse.json({ error: "The LeetCode tracker isn't set up in the database yet." }, { status: 503 });
    console.error("LeetCode GET error:", error);
    return FAILED();
  }
}

/** PUT { studentId, username }: set or clear (empty username) a student's LeetCode username. */
export async function PUT(request: Request) {
  const authorization = await requireRoles(STAFF);
  if (authorization.response) return authorization.response;
  if (authorization.profile.viewing_as) return NextResponse.json({ error: "View as is read-only" }, { status: 403 });
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const studentId = isUuid(body.studentId) ? (body.studentId as string) : null;
    const raw = typeof body.username === "string" ? body.username.trim() : "";
    const username = raw ? cleanUsername(raw) : null;
    if (!studentId) return NextResponse.json({ error: "Pick a student" }, { status: 400 });
    if (raw && !username) return NextResponse.json({ error: "That doesn’t look like a LeetCode username" }, { status: 400 });
    const [student] = await loadScopedStudents(authorization.profile, { studentIds: [studentId] });
    if (!student) return NextResponse.json({ error: "This student isn’t in your squads or campus" }, { status: 403 });
    const problem = await saveUsername(studentId, username, authorization.user.id);
    if (problem) return NextResponse.json({ error: problem }, { status: 409 });
    await writeAuditLog(authorization.user.id, "leetcode_username_set", "student", studentId, { username });
    const [card] = await loadCards([student]);
    return NextResponse.json({ card });
  } catch (error) {
    console.error("LeetCode PUT error:", error);
    return FAILED();
  }
}
