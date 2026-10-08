import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { createRequestSupabaseClient } from "@/lib/auth/server";
import {
  LANGUAGES,
  loadStandings,
  rankRows,
  readFilters,
  viewerScope,
  type Language,
} from "@/lib/leaderboard/standings";

/**
 * Per-language leaderboard, open to every role and every university. Same
 * filters as the overall board plus ?language=cpp|java|nodejs|python.
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
    const value = searchParams.get("language")?.trim().toLowerCase();
    if (!value || !LANGUAGES.includes(value as Language))
      return NextResponse.json(
        { error: "language must be one of: cpp, java, nodejs, python" },
        { status: 400 },
      );
    const language = value as Language;

    const result = await loadStandings(
      searchParams.get("period")?.trim() || null,
    );
    if (result.notFound)
      return NextResponse.json({ error: "Week not found" }, { status: 404 });

    const { standings } = result;
    const leaderboard = rankRows(
      standings.rows,
      readFilters(searchParams),
      (row) => row.levels[language],
    ).map(({ rank, row }) => ({
      rank,
      student_id: row.student_id,
      student_name: row.student_name,
      university_id: row.university_id,
      university_name: row.university_name,
      squad_id: row.squad_id,
      squad_number: row.squad_number,
      belt_level: row.levels[language],
      change: row.previous
        ? row.levels[language] - row.previous[language]
        : 0,
    }));

    return NextResponse.json({
      language,
      periods: standings.periods,
      period: standings.period,
      universities: standings.universities,
      squads: standings.squads,
      viewer: viewerScope(currentUser.profile, standings.rows),
      leaderboard,
    });
  } catch (error) {
    console.error("Language leaderboard GET error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 },
    );
  }
}
