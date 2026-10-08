"use client";

/**
 * Shared pieces of a student profile: belt ladders, the growth chart and the
 * weekly log. Used by the history dialog, the full history page and the
 * public student overview.
 */

import { motion, useReducedMotion } from "motion/react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AXIS_TICK,
  CHART,
  ChartLegend,
  ChartTooltip,
  LANGUAGE_COLORS,
} from "@/components/dashboard/chart-kit";
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  type Language,
} from "@/lib/dashboard/metrics";
import { BeltStrip, BeltTag, LanguageLogo } from "@/components/belts/belts";
import { BELT_SLOTS, beltOf } from "@/lib/belts";

export type Membership = {
  squad_number: string | null;
  start_date: string | null;
  end_date: string | null;
};

export type WeeklyRecord = {
  academic_year: number | null;
  week_number: number | null;
  start_time: string | null;
  calculated_end_time: string | null;
  belt_test_updated_at: string | null;
  initial_belt_levels: Record<string, number> | null;
  final_belt_levels: Record<string, number> | null;
};

export type HistoryResponse = {
  student: {
    id: string;
    name: string | null;
    email: string | null;
    squad_number?: string | null;
    university_id?: string | null;
    university_name?: string | null;
    since?: string | null;
  };
  memberships: Membership[];
  weeklyRecords: WeeklyRecord[];
};

export const SERIES = LANGUAGES.map((language) => ({
  key: language,
  label: LANGUAGE_LABELS[language],
  color: LANGUAGE_COLORS[language],
}));

export function recordKey(record: WeeklyRecord) {
  return (record.academic_year ?? 0) * 100 + (record.week_number ?? 0);
}

export function weekLabel(record: WeeklyRecord) {
  return `W${record.week_number ?? "?"} '${String(record.academic_year ?? "").slice(-2)}`;
}

export function gained(record: WeeklyRecord) {
  let total = 0;
  for (const language of LANGUAGES) {
    const before = record.initial_belt_levels?.[language];
    const after = record.final_belt_levels?.[language];
    if (typeof before === "number" && typeof after === "number")
      total += Math.max(0, after - before);
  }
  return total;
}

/** Coding-workouts style: one row per language with its belt ladder. */
export function BeltsPanel({
  levels,
  previous,
  flat = false,
}: {
  levels: Partial<Record<Language, number>> | null | undefined;
  previous?: Partial<Record<Language, number>> | null;
  /** Inside a page Frame: panes divided by rules instead of bordered cards. */
  flat?: boolean;
}) {
  const reduced = useReducedMotion();
  const best = [...LANGUAGES].sort(
    (a, b) => (levels?.[b] ?? 0) - (levels?.[a] ?? 0),
  )[0];
  const bestBelt = beltOf(levels?.[best] ?? 0);
  return (
    <div
      className={
        flat
          ? "grid divide-y divide-line lg:grid-cols-[1fr_280px] lg:divide-x lg:divide-y-0"
          : "grid gap-4 lg:grid-cols-[1fr_240px]"
      }
    >
      <section className={flat ? "min-w-0" : "rounded-2xl border border-line"}>
        <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
          <h3 className="font-display text-[15px] font-semibold">
            Coding belts
          </h3>
          <span className="h-px flex-1 bg-line" />
          <span className="text-[12px] text-muted">
            {BELT_SLOTS} belts per language
          </span>
        </div>
        <ul className="divide-y divide-line">
          {LANGUAGES.map((language, index) => {
            const level = levels?.[language] ?? 0;
            const before = previous?.[language];
            const next = beltOf(level + 1);
            const promoted = typeof before === "number" && level > before;
            return (
              <motion.li
                key={language}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4"
              >
                <LanguageLogo language={language} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="w-16 font-display text-[15px] font-semibold">
                      {LANGUAGE_LABELS[language]}
                    </span>
                    <BeltStrip
                      level={level}
                      size="md"
                      delay={0.15 + index * 0.08}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <BeltTag level={level} />
                    {promoted ? (
                      <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success-text">
                        Promoted this week
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display text-[22px] font-bold leading-none tabular-nums">
                    {Math.min(level, BELT_SLOTS)}
                    <span className="text-[13px] font-semibold text-faint">
                      /{BELT_SLOTS}
                    </span>
                  </p>
                  <p className="mt-1 text-[11.5px] text-muted">
                    {level >= BELT_SLOTS ? "Top belt" : `Next: ${next.name}`}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </section>
      <aside
        className={`relative overflow-hidden p-5 ${flat ? "" : "rounded-2xl border border-line"}`}
        style={{
          background: `radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, ${bestBelt.color} 26%, transparent), transparent 70%), var(--surface-2)`,
        }}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
          Highest belt
        </p>
        <div className="mt-4 flex justify-center">
          <LanguageLogo language={best} size={64} />
        </div>
        <p className="mt-4 text-center font-display text-[20px] font-bold tracking-[-0.02em]">
          {bestBelt.name} Belt
        </p>
        <p className="text-center text-[12.5px] text-muted">
          in {LANGUAGE_LABELS[best]}
        </p>
        <div className="mt-4 flex justify-center">
          <BeltStrip level={bestBelt.level} size="sm" delay={0.3} />
        </div>
        <p className="mt-4 text-center text-[12px] text-muted">
          {LANGUAGES.reduce(
            (sum, language) => sum + (levels?.[language] ?? 0),
            0,
          )}{" "}
          belts across all languages
        </p>
      </aside>
    </div>
  );
}

export function ProgressPanel({
  records,
  latest,
  promotedWeeks,
  flat = false,
}: {
  records: WeeklyRecord[];
  latest: WeeklyRecord | undefined;
  promotedWeeks: number;
  flat?: boolean;
}) {
  if (!records.length)
    return <Empty message="No weekly belt records yet for this student." />;

  const chartData = records.map((record) => ({
    label: weekLabel(record),
    ...Object.fromEntries(
      LANGUAGES.map((language) => [
        language,
        record.final_belt_levels?.[language] ?? null,
      ]),
    ),
  }));
  const maxLevel = Math.max(
    1,
    ...LANGUAGES.map((language) => latest?.final_belt_levels?.[language] ?? 0),
  );

  return (
    <div
      className={
        flat
          ? "grid divide-y divide-line lg:grid-cols-[1.6fr_1fr] lg:divide-x lg:divide-y-0"
          : "grid gap-4 lg:grid-cols-[1.6fr_1fr]"
      }
    >
      <div
        className={
          flat
            ? "min-w-0 px-4 py-4 sm:px-5"
            : "rounded-2xl border border-line p-4"
        }
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="font-display text-[14px] font-semibold">
            Belt level by language
          </p>
          <ChartLegend series={SERIES} />
        </div>
        <div className={flat ? "h-72" : "h-56"}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 8, bottom: 0, left: -18 }}
            >
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={{ stroke: CHART.axis }}
                minTickGap={16}
              />
              <YAxis
                allowDecimals={false}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ stroke: CHART.axis }}
                content={
                  <ChartTooltip
                    series={SERIES}
                    formatValue={(value) =>
                      value === null ? "—" : `Belt ${value}`
                    }
                  />
                }
              />
              {SERIES.map((series) => (
                <Line
                  key={series.key}
                  type="monotone"
                  dataKey={series.key}
                  name={series.label}
                  stroke={series.color}
                  strokeWidth={2}
                  dot={
                    records.length < 16
                      ? { r: 3, strokeWidth: 0, fill: series.color }
                      : false
                  }
                  activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div
        className={
          flat ? "px-4 py-4 sm:px-5" : "rounded-2xl border border-line p-4"
        }
      >
        <p className="font-display text-[14px] font-semibold">
          Where they are now
        </p>
        <p className="text-[12px] text-muted">
          {latest ? `As of ${weekLabel(latest)}` : ""} · promoted in{" "}
          {promotedWeeks} of {records.length} weeks
        </p>
        <ul className="mt-4 space-y-3.5">
          {LANGUAGES.map((language, index) => {
            const level = latest?.final_belt_levels?.[language] ?? 0;
            const start = records[0]?.initial_belt_levels?.[language] ?? 0;
            return (
              <li key={language}>
                <div className="flex items-baseline justify-between text-[12.5px]">
                  <span className="font-semibold text-ink-2">
                    {LANGUAGE_LABELS[language]}
                  </span>
                  <span className="tabular-nums text-muted">
                    <span className="font-display text-[15px] font-bold text-ink">
                      {level}
                    </span>
                    {level > start ? (
                      <span className="ml-1.5 text-success-text">
                        +{level - start}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sunken">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: LANGUAGE_COLORS[language] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(level / maxLevel) * 100}%` }}
                    transition={{
                      delay: 0.1 + index * 0.08,
                      type: "spring",
                      stiffness: 120,
                      damping: 20,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function WeeklyLog({ records }: { records: WeeklyRecord[] }) {
  if (!records.length)
    return <Empty message="No weekly belt records yet for this student." />;
  const newestFirst = [...records].reverse();
  return (
    <ol className="relative space-y-2.5 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-line">
      {newestFirst.map((record, index) => {
        const delta = gained(record);
        return (
          <motion.li
            key={`${recordKey(record)}-${record.start_time}-${index}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(index, 10) * 0.03 }}
            className="relative grid grid-cols-[32px_1fr] gap-3"
          >
            <span
              className={`relative z-10 mt-2.5 grid h-[31px] w-[31px] place-items-center rounded-full border text-[10.5px] font-bold ${
                delta > 0
                  ? "border-success-line bg-success-soft text-success-text"
                  : "border-line bg-surface text-muted"
              }`}
            >
              {delta > 0 ? `+${delta}` : "·"}
            </span>
            <div className="rounded-xl border border-line bg-surface p-3 transition hover:border-line-strong hover:shadow-[var(--card-shadow)]">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-display text-[14px] font-semibold">
                  Week {record.week_number ?? "?"}
                  <span className="ml-1.5 text-[12px] font-normal text-muted">
                    {record.academic_year ?? ""}
                  </span>
                </p>
                <p className="text-[11.5px] text-muted">
                  {formatTimestamp(record.start_time)}
                  {record.belt_test_updated_at
                    ? ` · tested ${formatTimestamp(record.belt_test_updated_at)}`
                    : ""}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {LANGUAGES.map((language) => {
                  const before = record.initial_belt_levels?.[language];
                  const after = record.final_belt_levels?.[language];
                  if (after === undefined && before === undefined) return null;
                  const up =
                    typeof before === "number" &&
                    typeof after === "number" &&
                    after > before;
                  return (
                    <span
                      key={language}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11.5px] ${up ? "border-success-line bg-success-soft" : "border-line bg-surface-2"}`}
                    >
                      <LanguageLogo language={language} size={16} />
                      <span className="font-semibold text-ink-2">
                        {LANGUAGE_LABELS[language]}
                      </span>
                      <span className="tabular-nums text-muted">
                        {before ?? "—"}
                      </span>
                      <span className="text-faint">→</span>
                      <span
                        className={`font-bold tabular-nums ${up ? "text-success-text" : "text-ink"}`}
                      >
                        {after ?? "—"}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

export function formatTimestamp(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

export function Empty({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center text-sm text-muted">
      {message}
    </div>
  );
}
