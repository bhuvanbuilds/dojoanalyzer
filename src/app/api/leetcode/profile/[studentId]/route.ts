import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { createRequestSupabaseClient } from "@/lib/auth/server";
import { isUuid } from "@/lib/is-uuid";
import { supabaseAdmin } from "@/lib/supabase/server";
import { fetchTagCounts, loadCards, loadScopedStudents, syncStale } from "@/lib/leetcode-server";
import { achievementsFor, loadBoard } from "@/lib/gamification-server";
import { istDay } from "@/lib/leetcode";

/**
 * GET: one student's full LeetCode profile. Any signed-in user may view any
 * student: LeetCode profiles are public, and this is the same data.
 */
export async function GET(_request: Request, context: { params: Promise<{ studentId: string }> }) {
  const supabase = await createRequestSupabaseClient();
  const current = await getCurrentUserProfile(supabase);
  if (current.status !== "authenticated") return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { studentId } = await context.params;
  if (!isUuid(studentId)) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  try {
    const everyone = { ...current.profile, role: "super_admin" as const, squad_ids: null };
    const [student] = await loadScopedStudents(everyone, { studentIds: [studentId] });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    await syncStale([studentId], 10).catch(() => undefined);
    const [card] = await loadCards([student]);
    const isSelf = current.profile.role === "student" && current.profile.student_id === studentId;
    if (!card?.username)
      return NextResponse.json({
        student: { id: student.id, name: student.name, squad_number: student.squad_number, university_name: student.university_name },
        card,
        linked: false,
        isSelf,
      });

    // Rank among everyone on the same campus, for each period.
    const campus = await loadScopedStudents(everyone, { universityId: student.university_id });
    const [week, month, all, achievements, recent, daily, tags] = await Promise.all([
      loadBoard(campus, "week", studentId),
      loadBoard(campus, "month", studentId),
      loadBoard(campus, "all", studentId),
      achievementsFor(studentId),
      supabaseAdmin
        .from("leetcode_solves")
        .select("title_slug, title, solved_at, difficulty")
        .eq("student_id", studentId)
        .eq("counted", true)
        .order("solved_at", { ascending: false })
        .limit(15),
      supabaseAdmin.from("daily_challenges").select("day, title, completed_at").eq("student_id", studentId).order("day", { ascending: false }).limit(60),
      fetchTagCounts(card.username),
    ]);
    const standing = (board: Awaited<ReturnType<typeof loadBoard>>) => {
      const row = board.rows.find((item) => item.student_id === studentId);
      return { rank: row?.rank ?? null, of: board.rows.length, points: row?.points ?? 0 };
    };

    // Daily challenge: last 30 days and streaks.
    const doneDays = new Set((daily.data ?? []).filter((row) => row.completed_at).map((row) => row.day as string));
    const today = istDay();
    const history = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(`${today}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() - (29 - index));
      const day = date.toISOString().slice(0, 10);
      const row = (daily.data ?? []).find((item) => item.day === day);
      return { day, status: !row ? "none" : row.completed_at ? "done" : day === today ? "open" : "missed" };
    });

    // Topic strengths: the 14 tags with the most solves.
    const topics = Object.entries(tags ?? {})
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14)
      .map(([tag, count]) => ({ tag, count }));

    return NextResponse.json({
      student: { id: student.id, name: student.name, squad_number: student.squad_number, university_name: student.university_name },
      card,
      linked: true,
      isSelf,
      standing: { week: standing(week), month: standing(month), all: standing(all) },
      achievements,
      recent: recent.data ?? [],
      daily: { done: doneDays.size, history },
      topics,
    });
  } catch (error) {
    console.error("LeetCode profile error:", error);
    return NextResponse.json({ error: "Couldn’t load this LeetCode profile." }, { status: 500 });
  }
}
