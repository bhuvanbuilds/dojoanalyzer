/**
 * Belts are never taken away: once a student reaches a level in a language,
 * they keep it. Weekly sheets occasionally record a lower level than an
 * earlier week (a data-entry slip), so every place that reads belt records
 * passes them through here first.
 */

const LANGUAGES = ["cpp", "java", "nodejs", "python"] as const;

type Levels = Record<string, unknown> | null;

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Returns the records in their original order, with each record's
 * `final_belt_levels` raised to the highest level that student had reached
 * in that language in any earlier (or the same) week. `order` gives a
 * record's position in time, e.g. academic_year * 100 + week_number.
 */
export function keepEarnedBelts<
  T extends { student_id: string; final_belt_levels: Levels },
>(records: T[], order: (record: T) => number): T[] {
  const byStudent = new Map<string, number[]>();
  records.forEach((record, index) => {
    const list = byStudent.get(record.student_id) ?? [];
    list.push(index);
    byStudent.set(record.student_id, list);
  });

  const result = records.slice();
  for (const indices of byStudent.values()) {
    indices.sort((a, b) => order(records[a]) - order(records[b]));
    const best: Record<string, number> = {};
    for (const index of indices) {
      const record = records[index];
      const levels = record.final_belt_levels;
      if (!levels || typeof levels !== "object" || Array.isArray(levels)) continue;
      const raised: Record<string, unknown> = { ...levels };
      for (const language of LANGUAGES) {
        const value = numeric(levels[language]);
        if (value === null) continue;
        best[language] = Math.max(best[language] ?? value, value);
        raised[language] = best[language];
      }
      result[index] = { ...record, final_belt_levels: raised };
    }
  }
  return result;
}
