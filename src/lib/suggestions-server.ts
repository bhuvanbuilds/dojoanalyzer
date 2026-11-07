import "server-only";

import type { UserProfile } from "@/lib/auth/profile";
import { supabaseAdmin } from "@/lib/supabase/server";
import { loadTargetStudents } from "@/lib/belt-targets-server";
import { fetchTagCounts, syncStale } from "@/lib/leetcode-server";
import { TARGET_LANGUAGES, monthKey, type Levels, type TargetLanguage } from "@/lib/belt-targets";
import { SYLLABUS, beltByLevel, planTopics, type TopicPlan } from "@/lib/dojo-syllabus";

export type BeltPlan = { level: number; name: string; band: string; focus: string; outcome: string; topics: TopicPlan[] };

export type Suggestions = {
  levels: Levels;
  language: TargetLanguage;
  level: number;
  /** The belt being shown: the next one by default, or the one the student picked. */
  focusLevel: number | null;
  mastered: boolean;
  leetcode: { username: string | null; personalised: boolean };
  next: BeltPlan | null;
  review: BeltPlan | null;
  /** Every LeetCode problem we know this student has solved. */
  solved: string[];
};

const asPlan = (belt: NonNullable<ReturnType<typeof beltByLevel>>, topics: TopicPlan[]): BeltPlan => ({
  level: belt.level,
  name: belt.name,
  band: belt.band,
  focus: belt.focus,
  outcome: belt.outcome,
  topics,
});

/**
 * A student's practice plan: the next belt's topics (weakest first from their
 * LeetCode stats) and their current belt for review, with solved problems
 * marked. Language defaults to the one in their belt target, else their
 * strongest.
 */
export async function loadSuggestions(
  profile: UserProfile,
  askedLanguage?: string | null,
  askedBelt?: number | null,
): Promise<Suggestions> {
  const studentId = profile.student_id!;
  // A student's own belts and target, without any squad limit.
  const [me] = await loadTargetStudents({ ...profile, role: "super_admin", squad_ids: null }, monthKey(), { studentIds: [studentId] });
  const levels = me?.now ?? { cpp: 0, java: 0, nodejs: 0, python: 0 };
  const targetLanguage = TARGET_LANGUAGES.find((language) => (me?.target?.language_gains?.[language] ?? 0) > 0);
  const language: TargetLanguage = TARGET_LANGUAGES.includes(askedLanguage as TargetLanguage)
    ? (askedLanguage as TargetLanguage)
    : (targetLanguage ?? [...TARGET_LANGUAGES].sort((a, b) => levels[b] - levels[a])[0]);
  const level = Math.max(0, Math.min(SYLLABUS.length, levels[language]));

  const account = await supabaseAdmin.from("leetcode_accounts").select("username").eq("student_id", studentId).maybeSingle();
  const username = (account.data?.username as string | undefined) ?? null;
  // Pick up anything solved in the last few minutes before deciding what's left.
  if (username) await syncStale([studentId], 3).catch(() => undefined);
  const [tagCounts, solves] = await Promise.all([
    username ? fetchTagCounts(username) : Promise.resolve(null),
    supabaseAdmin.from("leetcode_solves").select("title_slug").eq("student_id", studentId),
  ]);
  const solved = new Set((solves.data ?? []).map((row) => row.title_slug as string));

  // Any belt can be browsed; by default it's the next one to earn.
  const picked = askedBelt && Number.isInteger(askedBelt) && askedBelt >= 1 && askedBelt <= SYLLABUS.length ? askedBelt : null;
  const focusLevel = picked ?? (level < SYLLABUS.length ? level + 1 : null);
  const next = focusLevel ? beltByLevel(focusLevel) : null;
  const current = !picked && level > 0 ? beltByLevel(level) : null;
  return {
    levels,
    language,
    level,
    focusLevel,
    mastered: level >= SYLLABUS.length,
    leetcode: { username, personalised: Boolean(tagCounts) },
    next: next ? asPlan(next, planTopics(next, tagCounts, solved)) : null,
    review: current ? asPlan(current, planTopics(current, tagCounts, solved)) : null,
    solved: [...solved],
  };
}
