// LeetCode tracker: shared shapes and pure helpers. No imports, so tests can
// load it directly.

export const LEETCODE_USERNAME = /^[A-Za-z0-9_-]{1,40}$/;

/** Accepts a bare username or a profile link like leetcode.com/u/name/. */
export function cleanUsername(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let value = raw.trim();
  const link = /leetcode\.com\/(?:u\/)?([A-Za-z0-9_-]+)/i.exec(value);
  if (link) value = link[1];
  value = value.replace(/^@/, "").replace(/\/+$/, "");
  return LEETCODE_USERNAME.test(value) ? value : null;
}

/** "2026-11-06": the calendar day in India (days run 12 am to 12 am IST). */
export function istDay(date: Date | number = new Date()) {
  const time = typeof date === "number" ? date : date.getTime();
  return new Date(time + 5.5 * 3_600_000).toISOString().slice(0, 10);
}

/** LeetCode's calendar keys are unix seconds at midnight UTC of each day. */
export function calendarDays(calendar: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!calendar || typeof calendar !== "object") return out;
  for (const [key, value] of Object.entries(calendar as Record<string, unknown>)) {
    const seconds = Number(key);
    const count = Number(value);
    if (!Number.isFinite(seconds) || !Number.isFinite(count) || count <= 0) continue;
    const day = new Date(seconds * 1000).toISOString().slice(0, 10);
    out[day] = (out[day] ?? 0) + count;
  }
  return out;
}

export type RecentSolve = {
  slug: string;
  title: string;
  /** Latest accepted submission. */
  at: number;
  /** Earliest accepted submission of this problem in LeetCode's recent list. */
  firstAt?: number;
};

/**
 * Which newly seen accepted problems count as new solves. LeetCode's solved
 * total only grows for problems never solved before, so at most
 * `total - previousTotal` of them are genuinely new; the most recent ones get
 * the credit.
 *
 * On the first sync there's no previous total. Earlier days are the starting
 * point, but a problem first accepted today (no older accepted submission in
 * the list) still counts, so linking late in the day doesn't leave the card red.
 */
export function creditNewSolves(fresh: RecentSolve[], previousTotal: number | null, total: number, today = istDay()) {
  const newestFirst = [...fresh].sort((a, b) => b.at - a.at);
  if (previousTotal === null)
    return newestFirst.map((solve) => ({ ...solve, counted: istDay(solve.firstAt ?? solve.at) === today }));
  const allowed = Math.max(0, total - previousTotal);
  return newestFirst.map((solve, index) => ({ ...solve, counted: index < allowed }));
}

/** Consecutive days with at least one solve, ending today (or yesterday if today has none yet). */
export function solveStreak(days: Record<string, number>, today = istDay()) {
  const step = (day: string) => {
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
  };
  let day = (days[today] ?? 0) > 0 ? today : step(today);
  let streak = 0;
  while ((days[day] ?? 0) > 0) {
    streak += 1;
    day = step(day);
  }
  return streak;
}

export type LeetCodeCard = {
  student_id: string;
  name: string;
  squad_number: string;
  university_name: string | null;
  username: string | null;
  avatar_url: string | null;
  total_solved: number | null;
  easy_solved: number | null;
  medium_solved: number | null;
  hard_solved: number | null;
  /** LeetCode's own submission streak. */
  leetcode_streak: number | null;
  /** New problems solved per IST day, from our tracking. */
  solved_days: Record<string, number>;
  /** LeetCode's submission calendar per day (any submission), past year. */
  activity_days: Record<string, number>;
  solved_today: number;
  solve_streak: number;
  last_synced_at: string | null;
  sync_error: string | null;
};

export type CardStatus = "solved" | "pending" | "missing";
export const cardStatus = (card: Pick<LeetCodeCard, "username" | "solved_today">): CardStatus =>
  !card.username ? "missing" : card.solved_today > 0 ? "solved" : "pending";
