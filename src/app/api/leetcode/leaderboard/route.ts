import { after, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { createRequestSupabaseClient } from "@/lib/auth/server";
import { isUuid } from "@/lib/is-uuid";
import { boardStudents, loadBoard, type Period } from "@/lib/gamification-server";
import { loadCards, syncStale } from "@/lib/leetcode-server";
import { istDay } from "@/lib/leetcode";

// The cards show the last 18 weeks of LeetCode activity.
const CALENDAR_DAYS = 18 * 7;

/**
 * GET ?period=week|month|all&university_id=…: LeetCode points table, with each
 * student's recent activity calendar. Students see their own campus; staff see
 * their scope (super admins pick a campus). Viewing it also refreshes, in the
 * background, accounts not synced in the last hour, so data never goes stale.
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
    const [board, cards] = await Promise.all([
      loadBoard(students, period, current.profile.role === "student" ? current.profile.student_id : null),
      loadCards(students),
    ]);
    const since = istDay(Date.now() - CALENDAR_DAYS * 86_400_000);
    const byStudent = new Map(cards.map((card) => [card.student_id, card]));
    const rows = board.rows.map((row) => {
      const card = byStudent.get(row.student_id);
      const activity = Object.fromEntries(Object.entries(card?.activity_days ?? {}).filter(([day]) => day >= since));
      return {
        ...row,
        activity_days: activity,
        total_solved: card?.total_solved ?? null,
        streak: card?.leetcode_streak ?? null,
        solved_today: card?.solved_today ?? 0,
      };
    });
    after(() => syncStale(students.map((student) => student.id), 60, 30).catch(() => undefined));
    return NextResponse.json({ period, ...board, rows, total: students.length });
  } catch (error) {
    console.error("LeetCode leaderboard error:", error);
    return NextResponse.json({ error: "Couldn’t load the leaderboard." }, { status: 500 });
  }
}
