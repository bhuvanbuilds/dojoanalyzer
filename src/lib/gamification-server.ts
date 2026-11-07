import "server-only";

import type { UserProfile } from "@/lib/auth/profile";
import { supabaseAdmin } from "@/lib/supabase/server";
import { loadScopedStudents, type ScopedStudent } from "@/lib/leetcode-server";
import { DAILY_BONUS, achievements, lifetimePoints, pointsFor, type Achievement } from "@/lib/gamification";
import { istDay } from "@/lib/leetcode";

export type Period = "week" | "month" | "all";

export type BoardRow = {
  rank: number;
  student_id: string;
  name: string;
  squad_number: string;
  university_name: string | null;
  username: string;
  avatar_url: string | null;
  points: number;
  solved: { easy: number; medium: number; hard: number };
  daily: number;
  badges: number;
  isMe: boolean;
};

/** Start of the period in IST, as an ISO timestamp (null for all time). */
export function periodStart(period: Period, now = new Date()): string | null {
  if (period === "all") return null;
  const today = istDay(now);
  const date = new Date(`${today}T00:00:00Z`);
  if (period === "week") {
    // Weeks start on Monday.
    const weekday = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - weekday);
  } else date.setUTCDate(1);
  // Midnight IST is 18:30 UTC the day before.
  return new Date(date.getTime() - 5.5 * 3_600_000).toISOString();
}

/** Students a viewer competes with or oversees: staff get their scope, students their whole campus. */
export async function boardStudents(profile: UserProfile, universityId: string | null) {
  if (profile.role !== "student") return loadScopedStudents(profile, { universityId });
  const [me] = await loadScopedStudents({ ...profile, role: "super_admin", squad_ids: null }, { studentIds: [profile.student_id!] });
  if (!me) return [];
  return loadScopedStudents({ ...profile, role: "super_admin", squad_ids: null }, { universityId: me.university_id });
}

type Activity = {
  accounts: Map<string, { username: string; avatar_url: string | null; easy: number; medium: number; hard: number; all: number }>;
  solves: Map<string, Array<{ solved_at: string; difficulty: string | null }>>;
  daily: Map<string, string[]>;
};

/** Accounts, tracked new solves and completed daily challenges for these students. */
async function loadActivity(ids: string[]): Promise<Activity> {
  const [accounts, solves, daily] = await Promise.all([
    supabaseAdmin
      .from("leetcode_accounts")
      .select("student_id, username, avatar_url, total_solved, easy_solved, medium_solved, hard_solved")
      .in("student_id", ids),
    supabaseAdmin.from("leetcode_solves").select("student_id, solved_at, difficulty").in("student_id", ids).eq("counted", true),
    supabaseAdmin.from("daily_challenges").select("student_id, day").in("student_id", ids).not("completed_at", "is", null),
  ]);
  for (const result of [accounts, solves, daily]) if (result.error) throw result.error;
  const activity: Activity = { accounts: new Map(), solves: new Map(), daily: new Map() };
  for (const row of accounts.data ?? [])
    activity.accounts.set(row.student_id as string, {
      username: row.username as string,
      avatar_url: (row.avatar_url as string | null) ?? null,
      easy: (row.easy_solved as number | null) ?? 0,
      medium: (row.medium_solved as number | null) ?? 0,
      hard: (row.hard_solved as number | null) ?? 0,
      all: (row.total_solved as number | null) ?? 0,
    });
  for (const row of solves.data ?? []) {
    const list = activity.solves.get(row.student_id as string) ?? [];
    list.push({ solved_at: row.solved_at as string, difficulty: (row.difficulty as string | null) ?? null });
    activity.solves.set(row.student_id as string, list);
  }
  for (const row of daily.data ?? []) activity.daily.set(row.student_id as string, [...(activity.daily.get(row.student_id as string) ?? []), row.day as string]);
  return activity;
}

const unlockedCount = (activity: Activity, id: string) => {
  const account = activity.accounts.get(id);
  if (!account) return 0;
  return achievements({
    totals: { all: account.all, easy: account.easy, medium: account.medium, hard: account.hard },
    solves: activity.solves.get(id) ?? [],
    dailyDays: activity.daily.get(id) ?? [],
  }).filter((item) => item.unlocked).length;
};

/**
 * Points table for these students. Week and month count new problems tracked
 * in that period plus daily-challenge bonuses; all time uses LeetCode's
 * lifetime solved counts plus every daily bonus.
 */
export async function loadBoard(students: ScopedStudent[], period: Period, meId: string | null) {
  const ids = students.map((student) => student.id);
  if (!ids.length) return { rows: [] as BoardRow[], unlinked: 0 };
  const activity = await loadActivity(ids);
  const start = periodStart(period);
  const startDay = start ? istDay(new Date(start).getTime() + 3_600_000) : null;

  const rows: Omit<BoardRow, "rank">[] = [];
  for (const student of students) {
    const account = activity.accounts.get(student.id);
    if (!account) continue;
    const solves = (activity.solves.get(student.id) ?? []).filter((solve) => !start || solve.solved_at >= start);
    const daily = (activity.daily.get(student.id) ?? []).filter((day) => !startDay || day >= startDay).length;
    const count = (level: string) => solves.filter((solve) => (solve.difficulty ?? "Easy") === level).length;
    const solved =
      period === "all" ? { easy: account.easy, medium: account.medium, hard: account.hard } : { easy: count("Easy"), medium: count("Medium"), hard: count("Hard") };
    const points =
      (period === "all"
        ? lifetimePoints(account.easy, account.medium, account.hard)
        : solves.reduce((sum, solve) => sum + pointsFor(solve.difficulty), 0)) +
      daily * DAILY_BONUS;
    rows.push({
      student_id: student.id,
      name: student.name,
      squad_number: student.squad_number,
      university_name: student.university_name,
      username: account.username,
      avatar_url: account.avatar_url,
      points,
      solved,
      daily,
      badges: unlockedCount(activity, student.id),
      isMe: student.id === meId,
    });
  }
  rows.sort((a, b) => b.points - a.points || b.solved.hard - a.solved.hard || a.name.localeCompare(b.name));
  // Equal points share a rank.
  let rank = 0;
  const ranked = rows.map((row, index) => {
    if (index === 0 || row.points !== rows[index - 1].points) rank = index + 1;
    return { ...row, rank };
  });
  return { rows: ranked, unlinked: students.length - rows.length };
}

/** One student's achievements, with progress. */
export async function achievementsFor(studentId: string): Promise<Achievement[]> {
  const activity = await loadActivity([studentId]);
  const account = activity.accounts.get(studentId);
  return achievements({
    totals: { all: account?.all ?? 0, easy: account?.easy ?? 0, medium: account?.medium ?? 0, hard: account?.hard ?? 0 },
    solves: activity.solves.get(studentId) ?? [],
    dailyDays: activity.daily.get(studentId) ?? [],
  });
}
