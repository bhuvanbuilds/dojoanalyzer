import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { createRequestSupabaseClient } from "@/lib/auth/server";
import { isUuid } from "@/lib/is-uuid";
import { boardStudents, loadBoard, type Period } from "@/lib/gamification-server";

/**
 * GET ?period=week|month|all&university_id=…: LeetCode points table. Students
 * see their own campus; staff see their scope (super admins pick a campus).
 */
export async function GET(request: Request) {
  const supabase = await createRequestSupabaseClient();
  const current = await getCurrentUserProfile(supabase);
  if (current.status !== "authenticated") return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    const params = new URL(request.url).searchParams;
    const asked = params.get("period");
    const period: Period = asked === "month" || asked === "all" ? asked : "week";
    const universityId = params.get("university_id");
    const students = await boardStudents(current.profile, isUuid(universityId) ? universityId : null);
    const board = await loadBoard(students, period, current.profile.role === "student" ? current.profile.student_id : null);
    return NextResponse.json({ period, ...board, total: students.length });
  } catch (error) {
    console.error("LeetCode leaderboard error:", error);
    return NextResponse.json({ error: "Couldn’t load the leaderboard." }, { status: 500 });
  }
}
