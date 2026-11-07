// LeetCode points and achievements. Pure functions, no imports, so tests can
// load the file directly and the client and server agree on the rules.

export type Level = "Easy" | "Medium" | "Hard";

/** Points per new problem solved, by difficulty. */
export const POINTS: Record<Level, number> = { Easy: 10, Medium: 25, Hard: 50 };
/** Extra points for finishing the day's challenge. */
export const DAILY_BONUS = 15;

export const pointsFor = (difficulty: string | null | undefined) =>
  difficulty === "Hard" ? POINTS.Hard : difficulty === "Medium" ? POINTS.Medium : POINTS.Easy;

/** Lifetime points from LeetCode's own solved counts (for the all-time board). */
export const lifetimePoints = (easy: number, medium: number, hard: number) =>
  easy * POINTS.Easy + medium * POINTS.Medium + hard * POINTS.Hard;

export type Solve = { solved_at: string; difficulty: string | null };
export type AchievementInput = {
  totals: { all: number; easy: number; medium: number; hard: number };
  /** New problems tracked since linking (counted ones only). */
  solves: Solve[];
  /** Days (YYYY-MM-DD, IST) with the daily challenge completed. */
  dailyDays: string[];
};

export type Tier = "bronze" | "silver" | "gold" | "legend";
export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: "spark" | "flame" | "mountain" | "crown" | "sunrise" | "moon" | "calendar" | "target" | "bolt" | "shield";
  tier: Tier;
  progress: number;
  goal: number;
  unlocked: boolean;
};

const istHour = (iso: string) => (new Date(iso).getUTCHours() * 60 + new Date(iso).getUTCMinutes() + 330) / 60 % 24;
const istDay = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
const nextDay = (day: string) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

/** Longest run of consecutive days in a list of YYYY-MM-DD days. */
export function longestRun(days: string[]) {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of sorted) {
    run = previous && nextDay(previous) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

/** Most new problems solved in one IST day. */
const bestDay = (solves: Solve[]) => {
  const counts = new Map<string, number>();
  for (const solve of solves) counts.set(istDay(solve.solved_at), (counts.get(istDay(solve.solved_at)) ?? 0) + 1);
  return Math.max(0, ...counts.values());
};

/** True if both days of some weekend (Sat + Sun, IST) have a solve. */
const weekendCount = (solves: Solve[]) => {
  const days = new Set(solves.map((solve) => istDay(solve.solved_at)));
  let weekends = 0;
  for (const day of days) if (new Date(`${day}T00:00:00Z`).getUTCDay() === 6 && days.has(nextDay(day))) weekends += 1;
  return weekends;
};

/** Every achievement with progress; the order is the order they're shown in. */
export function achievements({ totals, solves, dailyDays }: AchievementInput): Achievement[] {
  const solveRun = longestRun(solves.map((solve) => istDay(solve.solved_at)));
  const dailyRun = longestRun(dailyDays);
  const early = solves.filter((solve) => istHour(solve.solved_at) < 8).length;
  const late = solves.filter((solve) => istHour(solve.solved_at) >= 23).length;
  const make = (
    id: string,
    name: string,
    description: string,
    icon: Achievement["icon"],
    tier: Tier,
    progress: number,
    goal: number,
  ): Achievement => ({ id, name, description, icon, tier, progress: Math.min(progress, goal), goal, unlocked: progress >= goal });

  return [
    make("first-solve", "First blood", "Solve your first new problem after linking LeetCode.", "spark", "bronze", solves.length, 1),
    make("daily-first", "Show up", "Finish your first daily challenge.", "target", "bronze", dailyDays.length, 1),
    make("solved-10", "Warming up", "10 problems solved on LeetCode.", "bolt", "bronze", totals.all, 10),
    make("streak-3", "On a roll", "Solve a new problem 3 days in a row.", "flame", "bronze", solveRun, 3),
    make("first-hard", "Giant slayer", "Solve your first Hard problem.", "mountain", "silver", totals.hard, 1),
    make("medium-10", "Middle path", "10 Medium problems solved.", "shield", "silver", totals.medium, 10),
    make("solved-50", "Half century", "50 problems solved on LeetCode.", "bolt", "silver", totals.all, 50),
    make("streak-7", "Week warrior", "Solve a new problem 7 days in a row.", "flame", "silver", solveRun, 7),
    make("daily-7", "Seven for seven", "Finish the daily challenge 7 days in a row.", "calendar", "silver", dailyRun, 7),
    make("busy-day", "Hat-trick", "Solve 3 new problems in a single day.", "spark", "silver", bestDay(solves), 3),
    make("early-bird", "Early bird", "Solve a problem before 8 am.", "sunrise", "bronze", early, 1),
    make("night-owl", "Night owl", "Solve a problem after 11 pm.", "moon", "bronze", late, 1),
    make("weekend", "Weekend warrior", "Solve on both Saturday and Sunday of a weekend.", "calendar", "silver", weekendCount(solves), 1),
    make("solved-100", "Centurion", "100 problems solved on LeetCode.", "crown", "gold", totals.all, 100),
    make("hard-10", "Summit seeker", "10 Hard problems solved.", "mountain", "gold", totals.hard, 10),
    make("streak-30", "Unbreakable", "Solve a new problem 30 days in a row.", "flame", "gold", solveRun, 30),
    make("daily-30", "Dojo discipline", "Finish the daily challenge 30 days in a row.", "calendar", "legend", dailyRun, 30),
    make("solved-250", "Grandmaster", "250 problems solved on LeetCode.", "crown", "legend", totals.all, 250),
  ];
}
