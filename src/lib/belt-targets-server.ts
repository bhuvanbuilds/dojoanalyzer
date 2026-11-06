import "server-only";

import type { UserProfile } from "@/lib/auth/profile";
import { squadLimit, inSquadLimit } from "@/lib/auth/scope";
import { keepEarnedBelts } from "@/lib/earned-belts";
import { supabaseAdmin } from "@/lib/supabase/server";
import { levelsOf, type BeltTarget, type Levels } from "@/lib/belt-targets";

export type TargetStudent = {
  id: string;
  name: string;
  email: string | null;
  squad_id: string;
  squad_number: string;
  university_id: string;
  university_name: string | null;
  /** Belts held when the month began (or at their first test this month). */
  start: Levels;
  /** Belts held now. */
  now: Levels;
  tested: boolean;
  target: BeltTarget | null;
};

type Membership = {
  student_id: string;
  students: { id: string; name: string; email: string | null } | Array<{ id: string; name: string; email: string | null }>;
  squads:
    | { id: string; squad_number: string; university_id: string; universities: { name: string } | Array<{ name: string }> | null }
    | Array<{ id: string; squad_number: string; university_id: string; universities: { name: string } | Array<{ name: string }> | null }>;
};

const one = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

/**
 * Students this person may set targets for: a mentor's squads, a campus
 * manager's campus, or (for super admins) one chosen campus or all of them.
 */
export async function loadTargetStudents(
  profile: UserProfile,
  month: string,
  options: { universityId?: string | null; studentIds?: string[] } = {},
): Promise<TargetStudent[]> {
  const limit = squadLimit(profile);
  const universityId = profile.role === "super_admin" ? (options.universityId ?? null) : profile.university_id;

  let memberships = supabaseAdmin
    .from("student_memberships")
    .select("student_id, students!inner(id, name, email), squads!inner(id, squad_number, university_id, universities(name:display_name))")
    .is("end_date", null);
  if (universityId) memberships = memberships.eq("squads.university_id", universityId);
  if (options.studentIds) memberships = memberships.in("student_id", options.studentIds);
  const { data, error } = await memberships;
  if (error) throw error;

  const students = new Map<string, Omit<TargetStudent, "start" | "now" | "tested" | "target">>();
  for (const row of (data ?? []) as Membership[]) {
    const student = one(row.students);
    const squad = one(row.squads);
    if (!student || !squad || !inSquadLimit(limit, squad.id)) continue;
    students.set(student.id, {
      id: student.id,
      name: student.name,
      email: student.email,
      squad_id: squad.id,
      squad_number: String(squad.squad_number),
      university_id: squad.university_id,
      university_name: one(squad.universities)?.name ?? null,
    });
  }
  const ids = [...students.keys()];
  if (!ids.length) return [];

  const [records, targets] = await Promise.all([
    supabaseAdmin
      .from("weekly_belt_records")
      .select(
        "student_id, initial_belt_levels, final_belt_levels, weeks!inner(academic_year, week_number, start_date), imports!inner(is_current, status)",
      )
      .in("student_id", ids)
      .eq("imports.is_current", true)
      .eq("imports.status", "imported"),
    supabaseAdmin
      .from("belt_targets")
      .select("student_id, month, total_gain, language_gains, note, seen_at, set_by, is_test")
      .in("student_id", ids)
      .eq("month", month),
  ]);
  if (records.error) throw records.error;
  if (targets.error) throw targets.error;

  type Row = {
    student_id: string;
    initial_belt_levels: Record<string, unknown> | null;
    final_belt_levels: Record<string, unknown> | null;
    weeks: { academic_year: number; week_number: number; start_date: string | null } | Array<{ academic_year: number; week_number: number; start_date: string | null }>;
  };
  const order = (row: Row) => {
    const week = one(row.weeks);
    return (week?.academic_year ?? 0) * 100 + (week?.week_number ?? 0);
  };
  const rows = keepEarnedBelts((records.data ?? []) as Row[], order).sort((a, b) => order(a) - order(b));
  const byStudent = new Map<string, Row[]>();
  for (const row of rows) byStudent.set(row.student_id, [...(byStudent.get(row.student_id) ?? []), row]);

  const setters = new Set((targets.data ?? []).map((row) => row.set_by).filter(Boolean) as string[]);
  const names = setters.size
    ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", [...setters])
    : { data: [], error: null };
  const setterName = new Map((names.data ?? []).map((row) => [row.id as string, row.full_name as string | null]));
  const targetByStudent = new Map(
    (targets.data ?? []).map((row) => [
      row.student_id as string,
      {
        month: row.month as string,
        total_gain: row.total_gain as number | null,
        language_gains: row.language_gains as BeltTarget["language_gains"],
        note: row.note as string | null,
        seen_at: row.seen_at as string | null,
        set_by_name: row.set_by ? (setterName.get(row.set_by as string) ?? null) : null,
        is_test: Boolean(row.is_test),
      } satisfies BeltTarget,
    ]),
  );

  return ids.map((id) => {
    const list = byStudent.get(id) ?? [];
    const before = list.filter((row) => (one(row.weeks)?.start_date ?? "") < month);
    const during = list.filter((row) => (one(row.weeks)?.start_date ?? "") >= month);
    const latest = list.at(-1);
    const now = levelsOf(latest?.final_belt_levels);
    const start = before.length
      ? levelsOf(before.at(-1)!.final_belt_levels)
      : during.length
        ? levelsOf(during[0].initial_belt_levels ?? during[0].final_belt_levels)
        : now;
    return {
      ...students.get(id)!,
      start,
      now,
      tested: during.length > 0,
      target: targetByStudent.get(id) ?? null,
    };
  });
}
