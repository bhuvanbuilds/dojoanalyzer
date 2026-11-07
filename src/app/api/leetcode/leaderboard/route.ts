import { after, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { createRequestSupabaseClient } from "@/lib/auth/server";
import { loadBoard, type Period } from "@/lib/gamification-server";
import { loadCards, loadScopedStudents, syncStale } from "@/lib/leetcode-server";
import { istDay } from "@/lib/leetcode";
import { loadLinks } from "@/lib/student-links-server";

// The cards show the last 26 weeks of LeetCode activity.
const CALENDAR_DAYS = 26 * 7;

/**
 * GET ?period=week|month|all&university_id&squad_id&search&today=done|pending:
 * LeetCode points table. Like the belt leaderboards, every role sees every
 * campus and the filters only narrow the view. Each row carries the student's
 * recent activity calendar, whether they solved a new problem today and their
 * GitHub / LinkedIn / CodeChef links. Viewing it also refreshes, in the
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
    const universityId = params.get("university_id")?.trim() || null;
    const squadId = params.get("squad_id")?.trim() || null;
    const search = params.get("search")?.trim().toLowerCase() || "";
    const today = params.get("today");

    const everyone = await loadScopedStudents({ ...current.profile, role: "super_admin", squad_ids: null });
    const universities = [...new Map(everyone.map((s) => [s.university_id, { id: s.university_id, name: s.university_name ?? "University" }])).values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const squads = [...new Map(everyone.map((s) => [s.squad_id, { id: s.squad_id, squad_number: s.squad_number, university_id: s.university_id }])).values()].sort(
      (a, b) => a.squad_number.localeCompare(b.squad_number, undefined, { numeric: true }),
    );
    const me = current.profile.role === "student" ? everyone.find((s) => s.id === current.profile.student_id) : undefined;
    const viewer = me
      ? { student_id: me.id, university_id: me.university_id, squad_id: me.squad_id }
      : { student_id: null, university_id: current.profile.university_id, squad_id: null };

    const students = everyone.filter(
      (s) =>
        (!universityId || s.university_id === universityId) &&
        (!squadId || s.squad_id === squadId) &&
        (!search || [s.name, s.university_name, s.squad_number].filter(Boolean).join(" ").toLowerCase().includes(search)),
    );
    const ids = students.map((student) => student.id);
    const [board, cards, links] = await Promise.all([
      loadBoard(students, period, current.profile.role === "student" ? current.profile.student_id : null),
      loadCards(students),
      loadLinks(ids),
    ]);
    const since = istDay(Date.now() - CALENDAR_DAYS * 86_400_000);
    const byStudent = new Map(cards.map((card) => [card.student_id, card]));
    const all = board.rows.map((row) => {
      const card = byStudent.get(row.student_id);
      const activity = Object.fromEntries(Object.entries(card?.activity_days ?? {}).filter(([day]) => day >= since));
      return {
        ...row,
        activity_days: activity,
        total_solved: card?.total_solved ?? null,
        streak: card?.leetcode_streak ?? null,
        solved_today: card?.solved_today ?? 0,
        links: links.get(row.student_id) ?? { github: null, linkedin: null, codechef: null },
      };
    });
    const doneToday = all.filter((row) => row.solved_today > 0).length;
    const rows = today === "done" ? all.filter((row) => row.solved_today > 0) : today === "pending" ? all.filter((row) => row.solved_today === 0) : all;
    after(() => syncStale(ids, 60, 30).catch(() => undefined));
    return NextResponse.json({
      period,
      rows,
      unlinked: board.unlinked,
      total: students.length,
      today: { done: doneToday, pending: all.length - doneToday },
      universities,
      squads,
      viewer,
    });
  } catch (error) {
    console.error("LeetCode leaderboard error:", error);
    return NextResponse.json({ error: "Couldn’t load the leaderboard." }, { status: 500 });
  }
}
