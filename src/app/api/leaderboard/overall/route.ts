import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { createRequestSupabaseClient } from "@/lib/auth/server";
import {
  loadStandings,
  rankLanguage,
  rankRows,
  readFilters,
  readRankBy,
  totalOf,
  viewerScope,
} from "@/lib/leaderboard/standings";

/**
 * Overall leaderboard: every role sees every university, ranked by total
 * belts across all languages. Filter with ?university_id, ?squad_id, ?search
 * and pick a period with ?period=<year>-<week> (defaults to the latest).
 * ?rank=primary|secondary ranks instead on each student's own primary or
 * secondary language belt, whatever that language is; students who haven't
 * chosen one are left out.
 */
export async function GET(request: Request) {
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

    const searchParams = new URL(request.url).searchParams;
    const result = await loadStandings(
      searchParams.get("period")?.trim() || null,
    );
    if (result.notFound)
      return NextResponse.json({ error: "Week not found" }, { status: 404 });

    const { standings } = result;
    const rankBy = readRankBy(searchParams);
    const score = (levels: typeof standings.rows[number]["levels"], language: ReturnType<typeof rankLanguage>) =>
      language ? levels[language] : totalOf(levels);
    const eligible = rankBy === "total" ? standings.rows : standings.rows.filter((row) => rankLanguage(row, rankBy));
    const leaderboard = rankRows(
      eligible,
      readFilters(searchParams),
      (row) => score(row.levels, rankLanguage(row, rankBy)),
    ).map(({ rank, row }) => ({
      rank,
      student_id: row.student_id,
      student_name: row.student_name,
      university_id: row.university_id,
      university_name: row.university_name,
      squad_id: row.squad_id,
      squad_number: row.squad_number,
      language_belts: row.levels,
      total_belts_earned: totalOf(row.levels),
      rank_language: rankLanguage(row, rankBy),
      rank_score: score(row.levels, rankLanguage(row, rankBy)),
      change: row.previous
        ? score(row.levels, rankLanguage(row, rankBy)) - score(row.previous, rankLanguage(row, rankBy))
        : 0,
    }));

    return NextResponse.json({
      periods: standings.periods,
      period: standings.period,
      universities: standings.universities,
      squads: standings.squads,
      viewer: viewerScope(currentUser.profile, standings.rows),
      rank: rankBy,
      // Students on this board without a chosen language (primary/secondary only).
      without_language: standings.rows.length - eligible.length,
      leaderboard,
    });
  } catch (error) {
    console.error("Overall leaderboard GET error:", error);
    return NextResponse.json(
      {
        error:
          "Something went wrong on our side. Please try again.",
      },
      { status: 500 },
    );
  }
}
