import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { createRequestSupabaseClient } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isUuid } from "@/lib/is-uuid";

type RouteContext = {
  params: Promise<{ studentId: string }>;
};

function isManagerOrMentor(role: string) {
  return role === "campus_manager" || role === "mentor";
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const supabase = await createRequestSupabaseClient();
    const currentUser = await getCurrentUserProfile(supabase);

    if (currentUser.status === "unauthenticated") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    if (
      currentUser.status !== "authenticated" ||
      (!isManagerOrMentor(currentUser.profile.role) &&
        currentUser.profile.role !== "super_admin") ||
      (currentUser.profile.role !== "super_admin" &&
        !currentUser.profile.university_id)
    ) {
      return NextResponse.json(
        { error: "Student history access is not authorized" },
        { status: 403 },
      );
    }

    // Staff open the full profile of any student, on any campus.
    const { studentId } = await context.params;
    if (!isUuid(studentId))
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    const membershipsQuery = supabaseAdmin
      .from("student_memberships")
      .select(
        "student_id, start_date, end_date, students!inner(id, name, email), squads!inner(id, squad_number, university_id, universities(name))",
      )
      .eq("student_id", studentId)
      .order("start_date", { ascending: true });
    const { data: memberships, error: membershipsError } =
      await membershipsQuery;

    if (membershipsError) {
      throw membershipsError;
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const firstMembership = memberships[0];
    const student = Array.isArray(firstMembership.students)
      ? firstMembership.students[0]
      : firstMembership.students;

    const recordsQuery = supabaseAdmin
      .from("weekly_belt_records")
      .select(
        "start_time, calculated_end_time, belt_test_updated_at, initial_belt_levels, final_belt_levels, weeks!inner(academic_year, week_number, university_id), imports!inner(is_current)",
      )
      .eq("student_id", studentId)
      .eq("imports.is_current", true)
      .order("start_time", { ascending: true });
    const { data: weeklyRecords, error: weeklyRecordsError } =
      await recordsQuery;

    if (weeklyRecordsError) {
      throw weeklyRecordsError;
    }

    // Belts are never lost: each week keeps every belt earned before it, so
    // neither the "before" nor the "after" level can drop below an earlier one.
    const keptRecords = (() => {
      const best: Record<string, number> = {};
      // `referencedTable` ordering only sorts the embedded week, not the rows:
      // order by academic week here, so belts carry forward week by week.
      const weekOf = (record: NonNullable<typeof weeklyRecords>[number]) =>
        Array.isArray(record.weeks) ? record.weeks[0] : record.weeks;
      const ordered = [...(weeklyRecords ?? [])].sort(
        (a, b) =>
          (weekOf(a)?.academic_year ?? 0) - (weekOf(b)?.academic_year ?? 0) ||
          (weekOf(a)?.week_number ?? 0) - (weekOf(b)?.week_number ?? 0) ||
          String(a.start_time).localeCompare(String(b.start_time)),
      );
      return ordered.map((record) => {
        const raise = (levels: unknown) => {
          if (!levels || typeof levels !== "object" || Array.isArray(levels))
            return levels as Record<string, number> | null;
          const raised: Record<string, number> = {};
          for (const [language, value] of Object.entries(levels)) {
            const level = Number(value);
            raised[language] = Number.isFinite(level)
              ? Math.max(level, best[language] ?? level)
              : level;
          }
          return raised;
        };
        const initial = raise(record.initial_belt_levels);
        const final = raise(record.final_belt_levels);
        for (const [language, level] of Object.entries(final ?? {}))
          if (Number.isFinite(level))
            best[language] = Math.max(best[language] ?? level, level);
        return { record, initial, final };
      });
    })();

    const currentMembership =
      memberships.find((membership) => !membership.end_date) ??
      memberships[memberships.length - 1];
    const currentSquad = Array.isArray(currentMembership.squads)
      ? currentMembership.squads[0]
      : currentMembership.squads;
    const currentUniversity = Array.isArray(currentSquad?.universities)
      ? currentSquad?.universities[0]
      : currentSquad?.universities;

    return NextResponse.json({
      student: {
        id: student?.id ?? studentId,
        name: student?.name ?? null,
        email: student?.email ?? null,
        squad_number: currentSquad?.squad_number ?? null,
        university_id: currentSquad?.university_id ?? null,
        university_name: currentUniversity?.name ?? null,
        since: currentMembership.start_date ?? null,
      },
      memberships: memberships.map((membership) => {
        const squad = Array.isArray(membership.squads)
          ? membership.squads[0]
          : membership.squads;

        return {
          squad_number: squad?.squad_number ?? null,
          start_date: membership.start_date,
          end_date: membership.end_date,
        };
      }),
      weeklyRecords: keptRecords.map(({ record, initial, final }) => {
        const week = Array.isArray(record.weeks)
          ? record.weeks[0]
          : record.weeks;

        return {
          academic_year: week?.academic_year ?? null,
          week_number: week?.week_number ?? null,
          start_time: record.start_time,
          calculated_end_time: record.calculated_end_time,
          belt_test_updated_at: record.belt_test_updated_at,
          initial_belt_levels: initial,
          final_belt_levels: final,
        };
      }),
    });
  } catch (error) {
    console.error("Student history GET error:", error);

    return NextResponse.json(
      {
        error:
          "Something went wrong on our side. Please try again.",
      },
      { status: 500 },
    );
  }
}
