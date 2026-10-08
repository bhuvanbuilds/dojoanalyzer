import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Global belt standings shared by the overall and language leaderboards.
 *
 * Every signed-in role sees every university; filters only narrow the view.
 * Each student is scored on their latest current-import record at or before
 * the selected period, so a university that hasn't imported the newest week
 * yet still ranks on its own latest results instead of dropping to zero.
 * "change" is the difference from that student's previous record.
 *
 * Emails are never part of the payload.
 */

export const LANGUAGES = ["cpp", "java", "nodejs", "python"] as const;
export type Language = (typeof LANGUAGES)[number];
export type LanguageBelts = Record<Language, number>;

export type Period = {
  /** "<academic_year>-<week_number>", the value the client sends back. */
  key: string;
  academic_year: number;
  week_number: number;
  start_date: string | null;
  end_date: string | null;
};

export type StandingRow = {
  student_id: string;
  student_name: string | null;
  university_id: string | null;
  university_name: string | null;
  squad_id: string | null;
  squad_number: string | null;
  levels: LanguageBelts;
  previous: LanguageBelts | null;
  /** Whether the student has any record up to the selected period. */
  tested: boolean;
};

export type Standings = {
  periods: Period[];
  period: Period | null;
  universities: Array<{ id: string; name: string }>;
  squads: Array<{ id: string; squad_number: string; university_id: string }>;
  rows: StandingRow[];
};

type MembershipRow = {
  student_id: string;
  students: One<{ id: string; name: string | null }>;
  squads: One<{ id: string; squad_number: string; university_id: string }>;
};

type WeekRow = {
  id: string;
  university_id: string;
  academic_year: number;
  week_number: number;
  start_date: string | null;
  end_date: string | null;
};

type RecordRow = {
  student_id: string;
  week_id: string;
  final_belt_levels: Record<string, unknown> | null;
};

type One<T> = T | T[] | null;

const PAGE_SIZE = 1000;

function one<T>(value: One<T>) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function loadAll<T>(load: (from: number, to: number) => Promise<T[]>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = await load(from, from + PAGE_SIZE - 1);
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function level(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function toBelts(levels: Record<string, unknown> | null): LanguageBelts {
  return {
    cpp: level(levels?.cpp),
    java: level(levels?.java),
    nodejs: level(levels?.nodejs),
    python: level(levels?.python),
  };
}

function order(week: { academic_year: number; week_number: number }) {
  return week.academic_year * 1000 + week.week_number;
}

export function periodKey(week: { academic_year: number; week_number: number }) {
  return `${week.academic_year}-${week.week_number}`;
}

export function totalOf(belts: LanguageBelts) {
  return belts.cpp + belts.java + belts.nodejs + belts.python;
}

/** Loads standings for a period key ("2026-14"); defaults to the latest. */
export async function loadStandings(requestedPeriod: string | null) {
  const [memberships, weeks] = await Promise.all([
    loadAll(async (from, to) => {
      const { data, error } = await supabaseAdmin
        .from("student_memberships")
        .select(
          "student_id, students!inner(id, name), squads!inner(id, squad_number, university_id)",
        )
        .is("end_date", null)
        .order("start_date", { ascending: false })
        .order("student_id", { ascending: true })
        .range(from, to);
      if (error) throw error;
      return (data ?? []) as MembershipRow[];
    }),
    loadAll(async (from, to) => {
      const { data, error } = await supabaseAdmin
        .from("weeks")
        .select(
          "id, university_id, academic_year, week_number, start_date, end_date, imports!inner(is_current, status)",
        )
        .eq("imports.is_current", true)
        .eq("imports.status", "imported")
        .order("academic_year", { ascending: true })
        .order("week_number", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to);
      if (error) throw error;
      return (data ?? []) as WeekRow[];
    }),
  ]);

  // Periods are shared across universities (each has its own week rows).
  const periodMap = new Map<string, Period>();
  for (const week of weeks) {
    const key = periodKey(week);
    const existing = periodMap.get(key);
    if (!existing)
      periodMap.set(key, {
        key,
        academic_year: week.academic_year,
        week_number: week.week_number,
        start_date: week.start_date,
        end_date: week.end_date,
      });
    else {
      if (week.start_date && (!existing.start_date || week.start_date < existing.start_date))
        existing.start_date = week.start_date;
      if (week.end_date && (!existing.end_date || week.end_date > existing.end_date))
        existing.end_date = week.end_date;
    }
  }
  const periods = [...periodMap.values()].sort((a, b) => order(b) - order(a));
  const period =
    (requestedPeriod ? periodMap.get(requestedPeriod) : periods[0]) ?? null;
  if (requestedPeriod && !period) return { notFound: true as const };

  const eligibleWeeks = period
    ? weeks.filter((week) => order(week) <= order(period))
    : [];
  const weekOrder = new Map(eligibleWeeks.map((week) => [week.id, order(week)]));

  const records = eligibleWeeks.length
    ? await loadAll(async (from, to) => {
        const { data, error } = await supabaseAdmin
          .from("weekly_belt_records")
          .select(
            "student_id, week_id, final_belt_levels, imports!inner(is_current, status)",
          )
          .in("week_id", [...weekOrder.keys()])
          .eq("imports.is_current", true)
          .eq("imports.status", "imported")
          .order("student_id", { ascending: true })
          .order("week_id", { ascending: true })
          .range(from, to);
        if (error) throw error;
        return (data ?? []) as RecordRow[];
      })
    : [];

  // Latest and previous record per student, by period order.
  const latest = new Map<string, { at: number; belts: LanguageBelts }>();
  const previous = new Map<string, { at: number; belts: LanguageBelts }>();
  for (const record of records) {
    const at = weekOrder.get(record.week_id);
    if (at === undefined) continue;
    const belts = toBelts(record.final_belt_levels);
    const current = latest.get(record.student_id);
    if (!current || at > current.at) {
      if (current) previous.set(record.student_id, current);
      latest.set(record.student_id, { at, belts });
    } else if (at < current.at) {
      const before = previous.get(record.student_id);
      if (!before || at > before.at)
        previous.set(record.student_id, { at, belts });
    }
  }

  const universityIds = new Set<string>();
  const squadMap = new Map<
    string,
    { id: string; squad_number: string; university_id: string }
  >();
  const byStudent = new Map<string, MembershipRow>();
  for (const membership of memberships) {
    if (byStudent.has(membership.student_id)) continue;
    byStudent.set(membership.student_id, membership);
    const squad = one(membership.squads);
    if (squad) {
      universityIds.add(squad.university_id);
      squadMap.set(squad.id, squad);
    }
  }

  const universities = universityIds.size
    ? await loadAll(async (from, to) => {
        const { data, error } = await supabaseAdmin
          .from("universities")
          .select("id, name")
          .in("id", [...universityIds])
          .order("name", { ascending: true })
          .range(from, to);
        if (error) throw error;
        return (data ?? []) as Array<{ id: string; name: string }>;
      })
    : [];
  const universityName = new Map(universities.map((u) => [u.id, u.name]));

  const rows: StandingRow[] = [...byStudent.values()].map((membership) => {
    const student = one(membership.students);
    const squad = one(membership.squads);
    const current = latest.get(membership.student_id);
    return {
      student_id: student?.id ?? membership.student_id,
      student_name: student?.name ?? null,
      university_id: squad?.university_id ?? null,
      university_name: squad
        ? (universityName.get(squad.university_id) ?? null)
        : null,
      squad_id: squad?.id ?? null,
      squad_number: squad?.squad_number ?? null,
      levels: current?.belts ?? { cpp: 0, java: 0, nodejs: 0, python: 0 },
      previous: previous.get(membership.student_id)?.belts ?? null,
      tested: Boolean(current),
    };
  });

  const squads = [...squadMap.values()].sort(
    (a, b) =>
      (universityName.get(a.university_id) ?? "").localeCompare(
        universityName.get(b.university_id) ?? "",
      ) ||
      a.squad_number.localeCompare(b.squad_number, undefined, {
        numeric: true,
      }),
  );

  return {
    notFound: false as const,
    standings: { periods, period, universities, squads, rows } as Standings,
  };
}

export type LeaderboardFilters = {
  universityId: string | null;
  squadId: string | null;
  search: string;
};

export function readFilters(searchParams: URLSearchParams): LeaderboardFilters {
  return {
    universityId: searchParams.get("university_id")?.trim() || null,
    squadId: searchParams.get("squad_id")?.trim() || null,
    search: searchParams.get("search")?.trim().toLowerCase() || "",
  };
}

/** Rows matching the filters, ranked by score (ties broken by name). */
export function rankRows<T extends StandingRow>(
  rows: T[],
  filters: LeaderboardFilters,
  score: (row: T) => number,
) {
  return rows
    .filter(
      (row) =>
        (!filters.universityId || row.university_id === filters.universityId) &&
        (!filters.squadId || row.squad_id === filters.squadId) &&
        (!filters.search ||
          [row.student_name, row.university_name, row.squad_number]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(filters.search)),
    )
    .sort(
      (a, b) =>
        score(b) - score(a) ||
        (a.student_name ?? "").localeCompare(b.student_name ?? ""),
    )
    .map((row, index) => ({ rank: index + 1, row }));
}

/** Where the signed-in user sits: their campus and, for students, squad. */
export function viewerScope(
  profile: { role: string; university_id: string | null; student_id: string | null },
  rows: StandingRow[],
) {
  if (profile.role === "student") {
    const own = rows.find((row) => row.student_id === profile.student_id);
    return {
      student_id: profile.student_id,
      university_id: own?.university_id ?? null,
      squad_id: own?.squad_id ?? null,
    };
  }
  return {
    student_id: null,
    university_id: profile.university_id,
    squad_id: null,
  };
}
