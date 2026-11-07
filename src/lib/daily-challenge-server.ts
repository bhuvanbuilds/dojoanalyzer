import "server-only";

import type { UserProfile } from "@/lib/auth/profile";
import { supabaseAdmin } from "@/lib/supabase/server";
import { istDay, solveStreak } from "@/lib/leetcode";
import { loadSuggestions } from "@/lib/suggestions-server";
import type { Difficulty } from "@/lib/dojo-syllabus";

export type DailyRow = {
  day: string;
  title_slug: string;
  title: string;
  difficulty: Difficulty;
  topic: string | null;
  belt_level: number | null;
  language: string | null;
  completed_at: string | null;
};

export type DailyState = {
  today: string;
  challenge: DailyRow | null;
  /** Consecutive days with the daily challenge done, ending today (or yesterday). */
  streak: number;
  best: number;
  /** Last 14 days, oldest first. */
  history: Array<{ day: string; status: "done" | "missed" | "open" | "none" }>;
  linked: boolean;
};

const addDays = (day: string, delta: number) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
};

/** Marks open challenges done when LeetCode shows the problem accepted on that same day. */
async function settle(studentId: string, rows: DailyRow[]) {
  const open = rows.filter((row) => !row.completed_at);
  if (!open.length) return rows;
  const { data, error } = await supabaseAdmin
    .from("leetcode_solves")
    .select("title_slug, solved_at")
    .eq("student_id", studentId)
    .in("title_slug", [...new Set(open.map((row) => row.title_slug))]);
  if (error) throw error;
  const solvedAt = new Map((data ?? []).map((row) => [row.title_slug as string, row.solved_at as string]));
  for (const row of open) {
    const at = solvedAt.get(row.title_slug);
    if (!at || istDay(new Date(at)) !== row.day) continue;
    const { error: updateError } = await supabaseAdmin
      .from("daily_challenges")
      .update({ completed_at: at })
      .eq("student_id", studentId)
      .eq("day", row.day)
      .is("completed_at", null);
    if (updateError) throw updateError;
    row.completed_at = at;
  }
  return rows;
}

/** Longest run of consecutive done days. */
function bestRun(days: string[]) {
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of sorted) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

/**
 * Today's challenge for a student, created on first visit of the day: the
 * easiest unsolved problem in their weakest next-belt topic that they haven't
 * been given before. Completion is automatic, from their synced LeetCode solves.
 */
export async function getDailyChallenge(profile: UserProfile): Promise<DailyState> {
  const studentId = profile.student_id!;
  const today = istDay();
  // loadSuggestions also syncs LeetCode first, so today's solves are in.
  const plan = await loadSuggestions(profile);

  const { data, error } = await supabaseAdmin
    .from("daily_challenges")
    .select("day, title_slug, title, difficulty, topic, belt_level, language, completed_at")
    .eq("student_id", studentId)
    .order("day", { ascending: false })
    .limit(400);
  if (error) throw error;
  const rows = await settle(studentId, (data ?? []) as DailyRow[]);
  let challenge = rows.find((row) => row.day === today) ?? null;

  if (!challenge) {
    const solved = new Set(plan.solved);
    const given = new Set(rows.map((row) => row.title_slug));
    const pools = [plan.next, plan.review].filter(Boolean);
    const candidates = pools.flatMap((belt) =>
      belt!.topics.flatMap((topic) =>
        topic.problems
          .filter((problem) => !solved.has(problem.slug))
          .map((problem) => ({ problem, topic: topic.name, level: belt!.level })),
      ),
    );
    const pick = candidates.find((item) => !given.has(item.problem.slug)) ?? candidates[0] ?? null;
    if (pick) {
      const row: DailyRow = {
        day: today,
        title_slug: pick.problem.slug,
        title: pick.problem.title,
        difficulty: pick.problem.difficulty,
        topic: pick.topic,
        belt_level: pick.level,
        language: plan.language,
        completed_at: null,
      };
      // "View as" is read-only: show the pick without saving it.
      if (!profile.viewing_as) {
        const { error: insertError } = await supabaseAdmin
          .from("daily_challenges")
          .upsert({ student_id: studentId, ...row }, { onConflict: "student_id,day", ignoreDuplicates: true });
        if (insertError) throw insertError;
        const saved = await supabaseAdmin
          .from("daily_challenges")
          .select("day, title_slug, title, difficulty, topic, belt_level, language, completed_at")
          .eq("student_id", studentId)
          .eq("day", today)
          .maybeSingle();
        challenge = (saved.data as DailyRow | null) ?? row;
      } else challenge = row;
      if (challenge && !challenge.completed_at) [challenge] = await settle(studentId, [challenge]);
    }
  }

  const doneDays = rows.filter((row) => row.completed_at).map((row) => row.day);
  if (challenge?.completed_at && !doneDays.includes(today)) doneDays.push(today);
  const byDay = new Map(rows.map((row) => [row.day, row]));
  if (challenge) byDay.set(today, challenge);
  const history = Array.from({ length: 14 }, (_, index) => {
    const day = addDays(today, index - 13);
    const row = byDay.get(day);
    const status: DailyState["history"][number]["status"] = !row ? "none" : row.completed_at ? "done" : day === today ? "open" : "missed";
    return { day, status };
  });

  return {
    today,
    challenge,
    streak: solveStreak(Object.fromEntries(doneDays.map((day) => [day, 1])), today),
    best: bestRun(doneDays),
    history,
    linked: Boolean(plan.leetcode.username),
  };
}
