import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { createRequestSupabaseClient } from "@/lib/auth/server";
import { keepEarnedBelts } from "@/lib/earned-belts";
import { inSquadLimit, squadLimit } from "@/lib/auth/scope";
import { supabaseAdmin } from "@/lib/supabase/server";

const LANGUAGES = ["cpp", "java", "nodejs", "python"] as const;
type Language = (typeof LANGUAGES)[number];

type Membership = {
  student_id: string;
  students:
    | { id: string; name: string | null; email: string | null }
    | Array<{ id: string; name: string | null; email: string | null }>
    | null;
  squads:
    | { id: string; squad_number: string; university_id: string }
    | Array<{ id: string; squad_number: string; university_id: string }>
    | null;
};

type RecordRow = {
  student_id: string;
  week_id: string;
  final_belt_levels: Record<string, unknown> | null;
  weeks:
    | {
        id: string;
        university_id: string;
        academic_year: number;
        week_number: number;
        start_date: string;
      }
    | Array<{
        id: string;
        university_id: string;
        academic_year: number;
        week_number: number;
        start_date: string;
      }>
    | null;
};

type ValidRecord = RecordRow & {
  levels: Record<Language, number>;
  date: string;
};
type LanguageMetric = {
  total_final: number;
  belts_earned: number;
  average_final: number | null;
};

type Scope = { universityId: string | null; studentId: string | null };

function nested<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] : value;
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseLevels(
  value: Record<string, unknown> | null,
): Record<Language, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const levels = {} as Record<Language, number>;
  for (const language of LANGUAGES) {
    const parsed = numberValue(value[language]);
    if (parsed === null || parsed < 0) return null;
    levels[language] = parsed;
  }
  return levels;
}

function total(levels: Record<Language, number>, languages: readonly Language[] = LANGUAGES) {
  return languages.reduce((sum, language) => sum + levels[language], 0);
}

function monthLabel(key: string) {
  return new Intl.DateTimeFormat("en", { month: "short" }).format(
    new Date(`${key}-01T00:00:00Z`),
  );
}

function emptyLanguageMetrics(): Record<Language, LanguageMetric> {
  return LANGUAGES.reduce(
    (metrics, language) => {
      metrics[language] = {
        total_final: 0,
        belts_earned: 0,
        average_final: null,
      };
      return metrics;
    },
    {} as Record<Language, LanguageMetric>,
  );
}

function earnedBetween(
  previous: Record<Language, number> | null,
  current: Record<Language, number>,
  languages: readonly Language[] = LANGUAGES,
) {
  if (!previous) return 0;
  return languages.reduce((earned, language) => {
    const increase = current[language] - previous[language];
    return earned + (increase > 0 ? increase : 0);
  }, 0);
}

export async function GET(request: Request) {
  try {
    const supabase = await createRequestSupabaseClient();
    const currentUser = await getCurrentUserProfile(supabase);

    if (currentUser.status === "unauthenticated") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }
    if (currentUser.status !== "authenticated") {
      return NextResponse.json(
        { error: "Analytics access is not authorized" },
        { status: 403 },
      );
    }
    const isSuperAdmin = currentUser.profile.role === "super_admin";
    if (
      !isSuperAdmin &&
      currentUser.profile.role !== "campus_manager" &&
      currentUser.profile.role !== "mentor"
    ) {
      return NextResponse.json(
        { error: "Analytics access is not authorized" },
        { status: 403 },
      );
    }
    if (!isSuperAdmin && !currentUser.profile.university_id) {
      return NextResponse.json(
        { error: "Analytics access is not authorized" },
        { status: 403 },
      );
    }

    const searchParams = new URL(request.url).searchParams;
    const requestedYear = searchParams.get("year");
    const requestedMonth = searchParams.get("month");
    const requestedUniversity = searchParams.get("university_id");
    const requestedSquad = searchParams.get("squad_id");
    const requestedLanguage = searchParams.get("language") ?? "all";
    const scope: Scope = {
      universityId: isSuperAdmin
        ? requestedUniversity
        : currentUser.profile.university_id,
      studentId: null,
    };

    if (
      requestedLanguage !== "all" &&
      !LANGUAGES.includes(requestedLanguage as Language)
    ) {
      return NextResponse.json({ error: "Invalid language" }, { status: 400 });
    }
    // Headline numbers follow the language filter; the breakdown always shows all.
    const focusLanguages =
      requestedLanguage === "all" ? LANGUAGES : [requestedLanguage as Language];

    if (
      !isSuperAdmin &&
      requestedUniversity &&
      requestedUniversity !== scope.universityId
    ) {
      return NextResponse.json(
        { error: "University access is not authorized" },
        { status: 403 },
      );
    }

    // Mentors only see their own squads.
    const limit = squadLimit(currentUser.profile);
    if (requestedSquad && !inSquadLimit(limit, requestedSquad))
      return NextResponse.json({ error: "Squad access is not authorized" }, { status: 403 });

    if (requestedSquad) {
      let squadQuery = supabaseAdmin
        .from("squads")
        .select("id")
        .eq("id", requestedSquad);
      if (scope.universityId)
        squadQuery = squadQuery.eq("university_id", scope.universityId);
      const { data: squad, error: squadError } = await squadQuery.maybeSingle();

      if (squadError) throw squadError;
      if (!squad)
        return NextResponse.json(
          { error: "Squad access is not authorized" },
          { status: 403 },
        );
    }

    let membershipsQuery = supabaseAdmin
      .from("student_memberships")
      .select(
        "student_id, students!inner(id, name, email), squads!inner(id, squad_number, university_id)",
      )
      .is("end_date", null)
      .order("start_date", { ascending: false });
    // PostgREST returns at most 1000 rows per request, so page through.
    const loadRecords = async () => {
      const rows: RecordRow[] = [];
      for (let from = 0; ; from += 1000) {
        let query = supabaseAdmin
          .from("weekly_belt_records")
          .select(
            "student_id, week_id, final_belt_levels, weeks!inner(id, university_id, academic_year, week_number, start_date), imports!inner(is_current)",
          )
          .eq("imports.is_current", true)
          .order("student_id")
          .order("week_id")
          .range(from, from + 999);
        if (scope.universityId)
          query = query.eq("weeks.university_id", scope.universityId);
        const { data, error } = await query;
        if (error) throw error;
        rows.push(...((data ?? []) as RecordRow[]));
        if (!data || data.length < 1000) return rows;
      }
    };
    let universitiesQuery = supabaseAdmin
      .from("universities")
      .select("id, name")
      .order("name");
    if (scope.universityId) {
      membershipsQuery = membershipsQuery.eq(
        "squads.university_id",
        scope.universityId,
      );
      universitiesQuery = universitiesQuery.eq("id", scope.universityId);
    }
    const [membershipsResult, recordRows, universitiesResult] =
      await Promise.all([membershipsQuery, loadRecords(), universitiesQuery]);

    if (membershipsResult.error) throw membershipsResult.error;
    if (universitiesResult.error) throw universitiesResult.error;

    const membershipByStudent = new Map<string, Membership>();
    for (const membership of (membershipsResult.data ?? []) as Membership[]) {
      const membershipSquad = nested(membership.squads);
      if (
        (!scope.studentId || membership.student_id === scope.studentId) &&
        (!requestedSquad || membershipSquad?.id === requestedSquad) &&
        inSquadLimit(limit, membershipSquad?.id) &&
        !membershipByStudent.has(membership.student_id)
      ) {
        membershipByStudent.set(membership.student_id, membership);
      }
    }

    const recordsByStudentWeek = new Map<string, ValidRecord>();
    // Belts are never lost: a lower later level keeps the earlier belt.
    const earnedRows = keepEarnedBelts(recordRows, (row) => {
      const week = nested(row.weeks);
      return week ? week.academic_year * 100 + week.week_number : 0;
    });
    for (const row of earnedRows) {
      if (!membershipByStudent.has(row.student_id)) continue;
      const week = nested(row.weeks);
      const levels = parseLevels(row.final_belt_levels);
      if (!week || !levels) continue;
      const key = `${row.student_id}:${row.week_id}`;
      if (!recordsByStudentWeek.has(key)) {
        recordsByStudentWeek.set(key, {
          ...row,
          levels,
          date: week.start_date,
        });
      }
    }

    const recordsByStudent = new Map<string, ValidRecord[]>();
    for (const record of recordsByStudentWeek.values()) {
      const records = recordsByStudent.get(record.student_id) ?? [];
      records.push(record);
      recordsByStudent.set(record.student_id, records);
    }
    for (const records of recordsByStudent.values()) {
      records.sort(
        (left, right) =>
          left.date.localeCompare(right.date) ||
          left.week_id.localeCompare(right.week_id),
      );
    }

    const availableYears = [
      ...new Set(
        [...recordsByStudentWeek.values()].map(
          (record) => nested(record.weeks)?.academic_year,
        ),
      ),
    ]
      .filter((year): year is number => typeof year === "number")
      .sort((a, b) => b - a);
    const year = requestedYear
      ? Number(requestedYear)
      : (availableYears[0] ?? new Date().getFullYear());
    if (!Number.isInteger(year) || year < 2000)
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });

    // An academic year can start mid-calendar-year (e.g. Nov → Sep), so
    // order months by when they actually happened, not by month number.
    const firstDateOfMonth = new Map<number, string>();
    for (const record of recordsByStudentWeek.values()) {
      if (nested(record.weeks)?.academic_year !== year) continue;
      const monthNumber = Number(record.date.slice(5, 7));
      const seen = firstDateOfMonth.get(monthNumber);
      if (!seen || record.date < seen) firstDateOfMonth.set(monthNumber, record.date);
    }
    const availableMonths = [...firstDateOfMonth.keys()].sort((a, b) =>
      firstDateOfMonth.get(a)!.localeCompare(firstDateOfMonth.get(b)!),
    );
    const month = requestedMonth
      ? Number(requestedMonth)
      : (availableMonths[availableMonths.length - 1] ?? 1);
    if (!Number.isInteger(month) || month < 1 || month > 12)
      return NextResponse.json({ error: "Invalid month" }, { status: 400 });

    const squadOptionsById = new Map<
      string,
      { id: string; squad_number: string }
    >();
    for (const membership of membershipByStudent.values()) {
      const squad = nested(membership.squads);
      if (squad)
        squadOptionsById.set(squad.id, {
          id: squad.id,
          squad_number: squad.squad_number,
        });
    }
    const squadOptions = Array.from(squadOptionsById.values());

    const monthRecords = new Map<string, ValidRecord>();
    const allYearRecords = [...recordsByStudentWeek.values()].filter(
      (record) => nested(record.weeks)?.academic_year === year,
    );
    for (const record of allYearRecords) {
      const recordMonth = Number(record.date.slice(5, 7));
      if (recordMonth === month) {
        const previous = monthRecords.get(record.student_id);
        if (!previous || record.date > previous.date)
          monthRecords.set(record.student_id, record);
      }
    }

    const calculateMonth = (monthNumber: number) => {
      const latest = new Map<string, ValidRecord>();
      for (const record of allYearRecords) {
        if (Number(record.date.slice(5, 7)) !== monthNumber) continue;
        const previous = latest.get(record.student_id);
        if (!previous || record.date > previous.date)
          latest.set(record.student_id, record);
      }
      const studentIds = [...latest.keys()];
      // Belts held at month end: every student's latest record up to the
      // last test this month, so untested students keep their belts and the
      // total never drops just because fewer students were tested.
      const cutoff = studentIds.reduce(
        (max, id) => (latest.get(id)!.date > max ? latest.get(id)!.date : max),
        "",
      );
      let held = 0;
      let holders = 0;
      for (const history of recordsByStudent.values()) {
        const last = [...history].reverse().find((record) => record.date <= cutoff);
        if (!last) continue;
        held += total(last.levels, focusLanguages);
        holders += 1;
      }
      let earned = 0;
      let improved = 0;
      for (const studentId of studentIds) {
        const history = recordsByStudent.get(studentId) ?? [];
        const studentEarned = history
          .filter((record) => Number(record.date.slice(5, 7)) === monthNumber)
          .reduce((sum, record) => {
            const currentIndex = history.findIndex(
              (item) => item.week_id === record.week_id,
            );
            const previous =
              currentIndex > 0 ? history[currentIndex - 1] : null;
            return sum + earnedBetween(previous?.levels ?? null, record.levels, focusLanguages);
          }, 0);
        earned += studentEarned;
        if (studentEarned > 0) improved += 1;
      }
      return {
        total_students: studentIds.length,
        total_belts: held,
        belts_earned: earned,
        improved_students: improved,
        average_belts_per_student: holders ? held / holders : null,
      };
    };

    const selectedMetrics = calculateMonth(month);
    const noChange = Math.max(
      0,
      selectedMetrics.total_students - selectedMetrics.improved_students,
    );
    const languageBreakdown = emptyLanguageMetrics();
    for (const record of monthRecords.values()) {
      for (const language of LANGUAGES) {
        languageBreakdown[language].total_final += record.levels[language];
      }
    }
    for (const record of allYearRecords.filter(
      (item) => Number(item.date.slice(5, 7)) === month,
    )) {
      const history = recordsByStudent.get(record.student_id) ?? [];
      const currentIndex = history.findIndex(
        (item) => item.week_id === record.week_id,
      );
      const previous = currentIndex > 0 ? history[currentIndex - 1] : null;
      for (const language of LANGUAGES) {
        languageBreakdown[language].belts_earned += previous
          ? Math.max(0, record.levels[language] - previous.levels[language])
          : 0;
      }
    }
    for (const language of LANGUAGES) {
      languageBreakdown[language].average_final = monthRecords.size
        ? languageBreakdown[language].total_final / monthRecords.size
        : null;
    }

    const monthlyTrend = availableMonths.map((monthNumber) => ({
      month: monthNumber,
      label: monthLabel(`${year}-${String(monthNumber).padStart(2, "0")}`),
      ...calculateMonth(monthNumber),
    }));
    const filters = {
      year,
      month,
      years: availableYears,
      months: availableMonths,
      universities: universitiesResult.data ?? [],
      squads: squadOptions,
      languages: ["all", ...LANGUAGES],
      language: requestedLanguage,
    };

    return NextResponse.json({
      filters,
      summary: { ...selectedMetrics, no_change_students: noChange },
      languageBreakdown,
      monthlyTrend,
    });
  } catch (error) {
    console.error("Monthly analytics GET error:", error);
    return NextResponse.json(
      {
        error:
          "Something went wrong on our side. Please try again.",
      },
      { status: 500 },
    );
  }
}
