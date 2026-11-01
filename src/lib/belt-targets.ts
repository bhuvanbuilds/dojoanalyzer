// Monthly belt targets: the shared shapes and the progress maths.
// Kept free of imports so tests can load it directly.

export const TARGET_LANGUAGES = ["cpp", "java", "nodejs", "python"] as const;
export type TargetLanguage = (typeof TARGET_LANGUAGES)[number];
export type Levels = Record<TargetLanguage, number>;

export const TARGET_LANGUAGE_LABELS: Record<TargetLanguage, string> = {
  cpp: "C++",
  java: "Java",
  nodejs: "Node.js",
  python: "Python",
};

export type BeltTarget = {
  month: string; // YYYY-MM-01
  total_gain: number | null;
  language_gains: Partial<Levels> | null;
  note: string | null;
  set_by_name?: string | null;
  seen_at?: string | null;
};

export type TargetProgress = {
  goal: number;
  gained: number;
  /** Per language when the target is per language. */
  languages: Array<{ language: TargetLanguage; goal: number; gained: number }>;
  done: boolean;
};

/** "2026-11-01" for any date in November 2026. */
export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Accepts "2026-11" or "2026-11-01"; null for anything else. */
export function parseMonth(value: unknown) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(0[1-9]|1[0-2])(?:-01)?$/.exec(value.trim());
  return match ? `${match[1]}-${match[2]}-01` : null;
}

/** "November 2026". */
export function monthLabel(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return new Date(year, mon - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

/** Days left in the month, counting today. */
export function daysLeft(month: string, today = new Date()) {
  const [year, mon] = month.split("-").map(Number);
  const end = new Date(year, mon, 0);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

export function levelsOf(raw: unknown): Levels {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const value = (key: string) => {
    const number = Number(source[key]);
    return Number.isFinite(number) ? number : 0;
  };
  return { cpp: value("cpp"), java: value("java"), nodejs: value("nodejs"), python: value("python") };
}

export const totalBelts = (levels: Levels) => TARGET_LANGUAGES.reduce((sum, language) => sum + levels[language], 0);

/** Validated per-language gains, or null when none are positive. */
export function cleanLanguageGains(raw: unknown): Partial<Levels> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Partial<Levels> = {};
  for (const language of TARGET_LANGUAGES) {
    const value = Number((raw as Record<string, unknown>)[language]);
    if (Number.isInteger(value) && value > 0 && value <= 10) out[language] = value;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Progress from the month's starting belts to now. Belts are never lost, so a
 * gain never goes below zero.
 */
export function targetProgress(target: BeltTarget, start: Levels, now: Levels): TargetProgress {
  const gainOf = (language: TargetLanguage) => Math.max(0, now[language] - start[language]);
  if (target.language_gains) {
    const languages = TARGET_LANGUAGES.filter((language) => (target.language_gains?.[language] ?? 0) > 0).map(
      (language) => ({ language, goal: target.language_gains![language]!, gained: Math.min(gainOf(language), target.language_gains![language]!) }),
    );
    const goal = languages.reduce((sum, item) => sum + item.goal, 0);
    const gained = languages.reduce((sum, item) => sum + item.gained, 0);
    return { goal, gained, languages, done: languages.every((item) => item.gained >= item.goal) };
  }
  const goal = target.total_gain ?? 0;
  const gained = TARGET_LANGUAGES.reduce((sum, language) => sum + gainOf(language), 0);
  return { goal, gained, languages: [], done: gained >= goal };
}

/** "Gain 3 belts" or "Java +1 · Python +2". */
export function describeTarget(target: Pick<BeltTarget, "total_gain" | "language_gains">) {
  if (target.language_gains)
    return TARGET_LANGUAGES.filter((language) => target.language_gains?.[language])
      .map((language) => `${TARGET_LANGUAGE_LABELS[language]} +${target.language_gains![language]}`)
      .join(" · ");
  const count = target.total_gain ?? 0;
  return `Gain ${count} belt${count === 1 ? "" : "s"}`;
}
