import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { createRequestSupabaseClient } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  LANGUAGES,
  loadStandings,
  totalOf,
  type LanguageBelts,
} from "@/lib/leaderboard/standings";

type RouteContext = { params: Promise<{ studentId: string }> };

type RecordRow = {
  final_belt_levels: Record<string, unknown> | null;
  weeks:
    | { academic_year: number; week_number: number }
    | Array<{ academic_year: number; week_number: number }>
    | null;
};

function belts(levels: Record<string, unknown> | null): LanguageBelts {
  const value = (key: string) => {
    const number = Number(levels?.[key]);
    return Number.isFinite(number) ? number : 0;
  };
  return {
    cpp: value("cpp"),
    java: value("java"),
    nodejs: value("nodejs"),
    python: value("python"),
  };
}

/**
 * A student's public overview, readable by every signed-in role: belts, the
 * week-by-week belt levels behind the growth graph, and where they rank.
 * Deliberately excludes email, test timestamps and the raw weekly log.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const supabase = await createRequestSupabaseClient();
    const currentUser = await getCurrentUserProfile(supabase);
    if (currentUser.status === "unauthenticated")
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    if (currentUser.status !== "authenticated")
      return NextResponse.json(
        { error: "Account profile is not assigned" },
        { status: 403 },
      );

    const { studentId } = await context.params;
    const [result, recordsResult] = await Promise.all([
      loadStandings(null),
      supabaseAdmin
        .from("weekly_belt_records")
        .select(
          "final_belt_levels, weeks!inner(academic_year, week_number), imports!inner(is_current, status)",
        )
        .eq("student_id", studentId)
        .eq("imports.is_current", true)
        .eq("imports.status", "imported")
        .order("academic_year", { ascending: true, referencedTable: "weeks" })
        .order("week_number", { ascending: true, referencedTable: "weeks" }),
    ]);
    if (recordsResult.error) throw recordsResult.error;
    if (result.notFound)
      return NextResponse.json({ error: "Student not found" }, { status: 404 });

    const rows = result.standings.rows;
    const row = rows.find((item) => item.student_id === studentId);
    if (!row)
      return NextResponse.json({ error: "Student not found" }, { status: 404 });

    const rankWithin = (pool: typeof rows) =>
      pool.filter((item) => totalOf(item.levels) > totalOf(row.levels))
        .length + 1;
    const university = rows.filter(
      (item) => item.university_id === row.university_id,
    );
    const squad = rows.filter((item) => item.squad_id === row.squad_id);
    const average = (pool: typeof rows) =>
      Object.fromEntries(
        LANGUAGES.map((language) => [
          language,
          pool.length
            ? pool.reduce((sum, item) => sum + item.levels[language], 0) /
              pool.length
            : 0,
        ]),
      ) as LanguageBelts;

    // One point per week; a re-imported week keeps its latest record.
    const series = new Map<
      string,
      { label: string; academic_year: number; week_number: number; levels: LanguageBelts }
    >();
    for (const record of (recordsResult.data ?? []) as RecordRow[]) {
      const week = Array.isArray(record.weeks) ? record.weeks[0] : record.weeks;
      if (!week) continue;
      const key = `${week.academic_year}-${week.week_number}`;
      series.set(key, {
        label: `W${week.week_number} '${String(week.academic_year).slice(-2)}`,
        academic_year: week.academic_year,
        week_number: week.week_number,
        levels: belts(record.final_belt_levels),
      });
    }

    return NextResponse.json({
      student: {
        id: row.student_id,
        name: row.student_name,
        squad_number: row.squad_number,
        university_name: row.university_name,
      },
      levels: row.levels,
      previous: row.previous,
      total: totalOf(row.levels),
      change: row.previous ? totalOf(row.levels) - totalOf(row.previous) : 0,
      rank: {
        overall: { position: rankWithin(rows), of: rows.length },
        university: { position: rankWithin(university), of: university.length },
        squad: { position: rankWithin(squad), of: squad.length },
      },
      averages: { squad: average(squad), university: average(university) },
      series: [...series.values()],
      isSelf:
        currentUser.profile.role === "student" &&
        currentUser.profile.student_id === studentId,
    });
  } catch (error) {
    console.error("Student overview GET error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 },
    );
  }
}
