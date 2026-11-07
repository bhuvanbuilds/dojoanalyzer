import "server-only";

import type { UserProfile } from "@/lib/auth/profile";
import { inSquadLimit, squadLimit } from "@/lib/auth/scope";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  calendarDays,
  creditNewSolves,
  istDay,
  solveStreak,
  type LeetCodeCard,
  type RecentSolve,
} from "@/lib/leetcode";

const QUERY = `query tracker($username: String!) {
  matchedUser(username: $username) {
    username
    profile { userAvatar }
    submitStatsGlobal { acSubmissionNum { difficulty count } }
    userCalendar { streak submissionCalendar }
  }
  recentAcSubmissionList(username: $username, limit: 20) { titleSlug title timestamp }
}`;

type Fetched = {
  username: string;
  avatar: string | null;
  solved: { all: number; easy: number; medium: number; hard: number };
  streak: number | null;
  calendar: Record<string, number>;
  recent: RecentSolve[];
};

/** Public profile data from LeetCode's GraphQL endpoint. Null when the user doesn't exist. */
export async function fetchLeetCode(username: string): Promise<Fetched | null> {
  const response = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Referer: "https://leetcode.com", "User-Agent": "Mozilla/5.0 DojoBeltAnalyzer" },
    body: JSON.stringify({ query: QUERY, variables: { username } }),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`LeetCode answered ${response.status}`);
  const json = (await response.json()) as {
    data?: {
      matchedUser: null | {
        username: string;
        profile: { userAvatar: string | null } | null;
        submitStatsGlobal: { acSubmissionNum: Array<{ difficulty: string; count: number }> } | null;
        userCalendar: { streak: number | null; submissionCalendar: string | null } | null;
      };
      recentAcSubmissionList: Array<{ titleSlug: string; title: string; timestamp: string }> | null;
    };
  };
  const user = json.data?.matchedUser;
  if (!user) return null;
  const count = (difficulty: string) =>
    user.submitStatsGlobal?.acSubmissionNum.find((item) => item.difficulty === difficulty)?.count ?? 0;
  let calendar: Record<string, number> = {};
  try {
    calendar = JSON.parse(user.userCalendar?.submissionCalendar ?? "{}") as Record<string, number>;
  } catch {
    calendar = {};
  }
  return {
    username: user.username,
    avatar: user.profile?.userAvatar ?? null,
    solved: { all: count("All"), easy: count("Easy"), medium: count("Medium"), hard: count("Hard") },
    streak: user.userCalendar?.streak ?? null,
    calendar,
    recent: (json.data?.recentAcSubmissionList ?? []).map((item) => ({
      slug: item.titleSlug,
      title: item.title,
      at: Number(item.timestamp) * 1000,
    })),
  };
}

type AccountRow = {
  student_id: string;
  username: string;
  total_solved: number | null;
  last_synced_at: string | null;
};

/** Pulls fresh data for one account and records any newly solved problems. */
export async function syncAccount(account: AccountRow) {
  const now = new Date().toISOString();
  let fetched: Fetched | null;
  try {
    fetched = await fetchLeetCode(account.username);
  } catch (error) {
    await supabaseAdmin
      .from("leetcode_accounts")
      .update({ sync_error: error instanceof Error ? error.message.slice(0, 200) : "Couldn’t reach LeetCode", last_synced_at: now })
      .eq("student_id", account.student_id);
    return;
  }
  if (!fetched) {
    await supabaseAdmin
      .from("leetcode_accounts")
      .update({ sync_error: "No LeetCode user with this username", last_synced_at: now })
      .eq("student_id", account.student_id);
    return;
  }

  // Problems in the recent list we haven't recorded yet.
  const slugs = [...new Set(fetched.recent.map((item) => item.slug))];
  const known = slugs.length
    ? await supabaseAdmin.from("leetcode_solves").select("title_slug").eq("student_id", account.student_id).in("title_slug", slugs)
    : { data: [], error: null };
  if (known.error) throw known.error;
  const seen = new Set((known.data ?? []).map((row) => row.title_slug as string));
  // The list is newest first; keep each problem's latest accepted time once.
  const fresh = new Map<string, RecentSolve>();
  for (const item of fetched.recent) {
    if (seen.has(item.slug)) continue;
    const known = fresh.get(item.slug);
    if (!known) fresh.set(item.slug, { ...item, firstAt: item.at });
    else known.firstAt = Math.min(known.firstAt ?? known.at, item.at);
  }
  const credited = creditNewSolves([...fresh.values()], account.total_solved, fetched.solved.all);
  if (credited.length) {
    const { error } = await supabaseAdmin.from("leetcode_solves").upsert(
      credited.map((item) => ({
        student_id: account.student_id,
        title_slug: item.slug,
        title: item.title,
        solved_at: new Date(item.at).toISOString(),
        counted: item.counted,
      })),
      { onConflict: "student_id,title_slug", ignoreDuplicates: true },
    );
    if (error) throw error;
  }

  const { error } = await supabaseAdmin
    .from("leetcode_accounts")
    .update({
      avatar_url: fetched.avatar,
      total_solved: fetched.solved.all,
      easy_solved: fetched.solved.easy,
      medium_solved: fetched.solved.medium,
      hard_solved: fetched.solved.hard,
      streak: fetched.streak,
      calendar: fetched.calendar,
      last_synced_at: now,
      sync_error: null,
      updated_at: now,
    })
    .eq("student_id", account.student_id);
  if (error) throw error;
  await fillDifficulties(account.student_id);
}

// Problem difficulty never changes; remember it for the life of the server.
const difficultyCache = new Map<string, "Easy" | "Medium" | "Hard">();

/** Difficulty per problem slug, looked up from LeetCode in batches of 25. */
export async function fetchDifficulties(slugs: string[]) {
  const out = new Map<string, "Easy" | "Medium" | "Hard">();
  const missing = [...new Set(slugs)].filter((slug) => {
    const known = difficultyCache.get(slug);
    if (known) out.set(slug, known);
    return !known;
  });
  for (let index = 0; index < missing.length; index += 25) {
    const chunk = missing.slice(index, index + 25);
    // Slugs are lowercase letters, digits and dashes, so they're safe inside the query.
    const safe = chunk.filter((slug) => /^[a-z0-9-]+$/.test(slug));
    if (!safe.length) continue;
    const query = `query { ${safe.map((slug, at) => `q${at}: question(titleSlug: "${slug}") { difficulty }`).join(" ")} }`;
    try {
      const response = await fetch("https://leetcode.com/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json", Referer: "https://leetcode.com", "User-Agent": "Mozilla/5.0 DojoBeltAnalyzer" },
        body: JSON.stringify({ query }),
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) continue;
      const json = (await response.json()) as { data?: Record<string, { difficulty: string } | null> };
      safe.forEach((slug, at) => {
        const difficulty = json.data?.[`q${at}`]?.difficulty;
        if (difficulty === "Easy" || difficulty === "Medium" || difficulty === "Hard") {
          difficultyCache.set(slug, difficulty);
          out.set(slug, difficulty);
        }
      });
    } catch {
      // Try again on the next sync.
    }
  }
  return out;
}

/** Fills in difficulty for this student's solves that don't have it yet. */
async function fillDifficulties(studentId: string) {
  const { data, error } = await supabaseAdmin
    .from("leetcode_solves")
    .select("title_slug")
    .eq("student_id", studentId)
    .is("difficulty", null)
    .limit(100);
  if (error || !data?.length) return;
  const found = await fetchDifficulties(data.map((row) => row.title_slug as string));
  const byDifficulty = new Map<string, string[]>();
  for (const [slug, difficulty] of found) byDifficulty.set(difficulty, [...(byDifficulty.get(difficulty) ?? []), slug]);
  for (const [difficulty, slugs] of byDifficulty)
    await supabaseAdmin.from("leetcode_solves").update({ difficulty }).eq("student_id", studentId).in("title_slug", slugs);
}

/** Syncs accounts not refreshed in `staleMinutes`, a few at a time to be gentle with LeetCode. */
export async function syncStale(studentIds: string[] | null, staleMinutes = 10, limit = 60) {
  const cutoff = new Date(Date.now() - staleMinutes * 60_000).toISOString();
  let query = supabaseAdmin
    .from("leetcode_accounts")
    .select("student_id, username, total_solved, last_synced_at")
    .or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`)
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (studentIds) {
    if (!studentIds.length) return 0;
    query = query.in("student_id", studentIds);
  }
  const { data, error } = await query;
  if (error) throw error;
  const queue = [...((data ?? []) as AccountRow[])];
  const workers = Array.from({ length: 4 }, async () => {
    for (let account = queue.shift(); account; account = queue.shift()) {
      try {
        await syncAccount(account);
      } catch (syncError) {
        console.error("LeetCode sync failed:", account.username, syncError);
      }
    }
  });
  await Promise.all(workers);
  return data?.length ?? 0;
}

type Membership = {
  student_id: string;
  students: { id: string; name: string; email: string | null } | Array<{ id: string; name: string; email: string | null }>;
  squads:
    | { id: string; squad_number: string; university_id: string; universities: { name: string } | Array<{ name: string }> | null }
    | Array<{ id: string; squad_number: string; university_id: string; universities: { name: string } | Array<{ name: string }> | null }>;
};
const one = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export type ScopedStudent = {
  id: string;
  name: string;
  email: string | null;
  squad_id: string;
  squad_number: string;
  university_id: string;
  university_name: string | null;
};

/** Students this person may see: a mentor's squads, a manager's campus, or a chosen campus for super admins. */
export async function loadScopedStudents(
  profile: UserProfile,
  options: { universityId?: string | null; studentIds?: string[] } = {},
): Promise<ScopedStudent[]> {
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
  const students = new Map<string, ScopedStudent>();
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
  return [...students.values()];
}

/** Cards for these students: account data, solves per day, and today's status. */
export async function loadCards(students: ScopedStudent[]): Promise<LeetCodeCard[]> {
  const ids = students.map((student) => student.id);
  if (!ids.length) return [];
  const since = new Date(Date.now() - 370 * 86_400_000).toISOString();
  const [accounts, solves] = await Promise.all([
    supabaseAdmin
      .from("leetcode_accounts")
      .select("student_id, username, avatar_url, total_solved, easy_solved, medium_solved, hard_solved, streak, calendar, last_synced_at, sync_error")
      .in("student_id", ids),
    supabaseAdmin
      .from("leetcode_solves")
      .select("student_id, solved_at")
      .in("student_id", ids)
      .eq("counted", true)
      .gte("solved_at", since),
  ]);
  if (accounts.error) throw accounts.error;
  if (solves.error) throw solves.error;

  const byStudent = new Map((accounts.data ?? []).map((row) => [row.student_id as string, row]));
  const days = new Map<string, Record<string, number>>();
  for (const row of solves.data ?? []) {
    const map = days.get(row.student_id as string) ?? {};
    const day = istDay(new Date(row.solved_at as string));
    map[day] = (map[day] ?? 0) + 1;
    days.set(row.student_id as string, map);
  }
  const today = istDay();
  return students.map((student) => {
    const account = byStudent.get(student.id);
    const solved = days.get(student.id) ?? {};
    return {
      student_id: student.id,
      name: student.name,
      squad_number: student.squad_number,
      university_name: student.university_name,
      username: (account?.username as string | undefined) ?? null,
      avatar_url: (account?.avatar_url as string | null | undefined) ?? null,
      total_solved: (account?.total_solved as number | null | undefined) ?? null,
      easy_solved: (account?.easy_solved as number | null | undefined) ?? null,
      medium_solved: (account?.medium_solved as number | null | undefined) ?? null,
      hard_solved: (account?.hard_solved as number | null | undefined) ?? null,
      leetcode_streak: (account?.streak as number | null | undefined) ?? null,
      solved_days: solved,
      activity_days: calendarDays(account?.calendar),
      solved_today: solved[today] ?? 0,
      solve_streak: solveStreak(solved, today),
      last_synced_at: (account?.last_synced_at as string | null | undefined) ?? null,
      sync_error: (account?.sync_error as string | null | undefined) ?? null,
    };
  });
}

/** Saves (or clears) a student's username. Returns an error message for the person, or null. */
export async function saveUsername(studentId: string, username: string | null, setBy: string) {
  if (!username) {
    const { error } = await supabaseAdmin.from("leetcode_accounts").delete().eq("student_id", studentId);
    if (error) throw error;
    await supabaseAdmin.from("leetcode_solves").delete().eq("student_id", studentId);
    return null;
  }
  const taken = await supabaseAdmin
    .from("leetcode_accounts")
    .select("student_id")
    // Case-insensitive exact match; "_" is a wildcard in LIKE, so escape it.
    .ilike("username", username.replace(/[\\%_]/g, "\\$&"))
    .neq("student_id", studentId)
    .maybeSingle();
  if (taken.error) throw taken.error;
  if (taken.data) return `@${username} is already linked to another student`;

  const current = await supabaseAdmin.from("leetcode_accounts").select("username").eq("student_id", studentId).maybeSingle();
  if (current.error) throw current.error;
  const changed = !current.data || (current.data.username as string).toLowerCase() !== username.toLowerCase();
  if (changed) {
    // A different account starts fresh: its history isn't this student's past solves.
    await supabaseAdmin.from("leetcode_solves").delete().eq("student_id", studentId);
  }
  const { error } = await supabaseAdmin.from("leetcode_accounts").upsert(
    {
      student_id: studentId,
      username,
      updated_by: setBy,
      updated_at: new Date().toISOString(),
      ...(changed ? { total_solved: null, last_synced_at: null, sync_error: null, calendar: null, streak: null } : {}),
    },
    { onConflict: "student_id" },
  );
  if (error) throw error;
  if (changed) await syncAccount({ student_id: studentId, username, total_solved: null, last_synced_at: null });
  return null;
}

// Per-topic solved counts change slowly; keep them for 30 minutes per user.
const tagCache = new Map<string, { at: number; counts: Record<string, number> }>();

/** LeetCode's solved count per topic tag ({ "binary-search": 12, … }), or null if unavailable. */
export async function fetchTagCounts(username: string): Promise<Record<string, number> | null> {
  const key = username.toLowerCase();
  const cached = tagCache.get(key);
  if (cached && Date.now() - cached.at < 30 * 60_000) return cached.counts;
  try {
    const response = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Referer: "https://leetcode.com", "User-Agent": "Mozilla/5.0 DojoBeltAnalyzer" },
      body: JSON.stringify({
        query: `query tags($username: String!) { matchedUser(username: $username) { tagProblemCounts {
          advanced { tagSlug problemsSolved } intermediate { tagSlug problemsSolved } fundamental { tagSlug problemsSolved } } } }`,
        variables: { username },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as {
      data?: { matchedUser: null | { tagProblemCounts: Record<string, Array<{ tagSlug: string; problemsSolved: number }>> } };
    };
    const groups = json.data?.matchedUser?.tagProblemCounts;
    if (!groups) return null;
    const counts: Record<string, number> = {};
    for (const list of Object.values(groups)) for (const item of list ?? []) counts[item.tagSlug] = item.problemsSolved;
    tagCache.set(key, { at: Date.now(), counts });
    return counts;
  } catch {
    return null;
  }
}
