"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Building2, Trophy, Users } from "lucide-react";
import {
  Cell,
  Cells,
  Frame,
  FrameMessage,
  Page,
  Panel,
  Split,
} from "@/components/ui/frame";
import { PanelSkeleton, Skeleton } from "@/components/ui/skeleton";
import { CountUp } from "@/components/reactbits/count-up";
import { StudentAvatar } from "@/components/students/avatar";
import { LanguageLogo } from "@/components/belts/belts";
import { LANGUAGE_COLORS } from "@/components/dashboard/chart-kit";
import {
  BeltsPanel,
  ProgressPanel,
  gained,
  type WeeklyRecord,
} from "@/components/students/history-panels";
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  type Language,
} from "@/lib/dashboard/metrics";

type Levels = Record<Language, number>;
type Rank = { position: number; of: number };

export type StudentOverview = {
  student: {
    id: string;
    name: string | null;
    squad_number: string | null;
    university_name: string | null;
  };
  levels: Levels;
  previous: Levels | null;
  total: number;
  change: number;
  rank: { overall: Rank; university: Rank; squad: Rank };
  averages: { squad: Levels; university: Levels };
  series: Array<{
    label: string;
    academic_year: number;
    week_number: number;
    levels: Levels;
  }>;
  isSelf: boolean;
};

type Load =
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "error"; message: string }
  | { status: "ready"; data: StudentOverview };

/** Fetches the public overview of one student (no email, no weekly log). */
export function useStudentOverview(studentId: string | null) {
  const [load, setLoad] = useState<Load & { id?: string }>({
    status: "loading",
  });
  useEffect(() => {
    if (!studentId) return;
    const controller = new AbortController();
    fetch(`/api/students/${studentId}/overview`, { signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as StudentOverview & {
          error?: string;
        };
        if (response.status === 404)
          return setLoad({ status: "not_found", id: studentId });
        if (!response.ok)
          throw new Error(result.error ?? "Unable to load this student.");
        setLoad({ status: "ready", data: result, id: studentId });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoad({
          status: "error",
          id: studentId,
          message:
            error instanceof Error ? error.message : "Unable to load this student.",
        });
      });
    return () => controller.abort();
  }, [studentId]);
  // A result for a previous student is stale while the next one loads.
  return load.id === studentId ? load : ({ status: "loading" } as Load);
}

/** Growth series as weekly records, so the shared progress chart can draw it. */
function asRecords(series: StudentOverview["series"]): WeeklyRecord[] {
  return series.map((point, index) => ({
    academic_year: point.academic_year,
    week_number: point.week_number,
    start_time: null,
    calculated_end_time: null,
    belt_test_updated_at: null,
    initial_belt_levels: index > 0 ? series[index - 1].levels : point.levels,
    final_belt_levels: point.levels,
  }));
}

/** Belts, growth graph and peer comparison: the body of any overview. */
export function OverviewPanels({ data }: { data: StudentOverview }) {
  const records = asRecords(data.series);
  const promotedWeeks = records.filter((record) => gained(record) > 0).length;
  return (
    <>
      <BeltsPanel levels={data.levels} previous={data.previous} flat />
      {records.length ? (
        <ProgressPanel
          records={records}
          latest={records.at(-1)}
          promotedWeeks={promotedWeeks}
          flat
        />
      ) : null}
    </>
  );
}

function ordinalRank(rank: Rank) {
  return rank.of ? `#${rank.position}` : "—";
}

/** Full-page overview, shared by /student (yourself) and /student/[id]. */
export function StudentOverviewPage({ studentId }: { studentId: string | null }) {
  const load = useStudentOverview(studentId);

  if (!studentId)
    return (
      <Page>
        <Frame>
          <FrameMessage title="No student record linked">
            Your account isn’t linked to a student record yet. Ask your campus
            manager to check your email in the student list.
          </FrameMessage>
        </Frame>
      </Page>
    );

  const data = load.status === "ready" ? load.data : null;

  return (
    <Page>
      <Frame>
        <div className="flex items-center justify-between gap-3 bg-surface-2 px-3 py-2 sm:px-4">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-ink-2 transition hover:bg-ink/5 hover:text-ink"
          >
            <ArrowLeft size={15} /> Leaderboard
          </Link>
          {data?.isSelf ? (
            <span className="rounded-full bg-ink px-2.5 py-1 text-[11.5px] font-semibold text-page">
              Your profile
            </span>
          ) : null}
        </div>

        <Hero studentId={studentId} data={data} />

        {load.status === "loading" ? (
          <PanelSkeleton rows={6} label="Loading profile" flat />
        ) : load.status === "not_found" ? (
          <FrameMessage title="Student not found">
            This student isn’t on the leaderboard.
          </FrameMessage>
        ) : load.status === "error" ? (
          <FrameMessage title="Couldn’t load this student">
            {load.message}
          </FrameMessage>
        ) : data ? (
          <>
            <Cells className="grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
              {[
                {
                  label: "Overall rank",
                  value: data.rank.overall.position,
                  hint: `of ${data.rank.overall.of} students`,
                  prefix: "#",
                },
                {
                  label: "Campus rank",
                  value: data.rank.university.position,
                  hint: data.student.university_name ?? "Their university",
                  prefix: "#",
                },
                {
                  label: "Squad rank",
                  value: data.rank.squad.position,
                  hint: data.student.squad_number
                    ? `of ${data.rank.squad.of} in Squad ${data.student.squad_number}`
                    : "No squad",
                  prefix: "#",
                },
                {
                  label: "Belts held",
                  value: data.total,
                  hint: "Across all four languages",
                },
                {
                  label: "Change",
                  value: data.change,
                  hint: "Since their previous test",
                  prefix: data.change > 0 ? "+" : "",
                },
              ].map((stat) => (
                <Cell key={stat.label} className="px-4 py-4 sm:px-5">
                  <p className="text-[12.5px] font-medium text-muted">
                    {stat.label}
                  </p>
                  <p className="mt-1.5 font-display text-[28px] font-bold leading-none tracking-[-0.03em] tabular-nums">
                    <CountUp to={stat.value} prefix={stat.prefix} />
                  </p>
                  <p className="mt-1.5 truncate text-[11.5px] text-muted">
                    {stat.hint}
                  </p>
                </Cell>
              ))}
            </Cells>
            <OverviewPanels data={data} />
            <Split className="xl:grid-cols-2">
              <Panel
                title="Against their squad"
                description="Belt level vs the squad average, per language"
              >
                <AverageBars levels={data.levels} average={data.averages.squad} />
              </Panel>
              <Panel
                title="Against their campus"
                description="Belt level vs the university average, per language"
              >
                <AverageBars
                  levels={data.levels}
                  average={data.averages.university}
                />
              </Panel>
            </Split>
          </>
        ) : null}
      </Frame>
    </Page>
  );
}

function Hero({
  studentId,
  data,
}: {
  studentId: string;
  data: StudentOverview | null;
}) {
  return (
    <section className="relative overflow-hidden px-4 py-6 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(700px 220px at 0% 0%, color-mix(in srgb, var(--brand) 13%, transparent), transparent 70%), radial-gradient(520px 200px at 100% 0%, color-mix(in srgb, var(--lang-python) 14%, transparent), transparent 70%)",
        }}
      />
      <div className="relative flex flex-wrap items-center gap-5">
        <div className="relative shrink-0">
          <span
            aria-hidden="true"
            className="dojo-anim absolute -inset-1 animate-[spin_8s_linear_infinite] rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, var(--brand), transparent 40%, var(--lang-python), transparent 80%, var(--brand))",
            }}
          />
          <span className="relative block rounded-full bg-surface p-1">
            <StudentAvatar
              id={studentId}
              name={data?.student.name ?? null}
              size={84}
            />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-text">
            Dojo profile
          </p>
          {data ? (
            <h1 className="mt-0.5 truncate font-display text-[28px] font-bold leading-tight tracking-[-0.03em] sm:text-[34px]">
              {data.student.name ?? "Unnamed student"}
            </h1>
          ) : (
            <Skeleton className="mt-2 h-8 w-56 max-w-full" />
          )}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-muted">
            {data?.student.squad_number ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-0.5 font-semibold text-ink-2">
                <Users size={12} /> Squad {data.student.squad_number}
              </span>
            ) : null}
            {data?.student.university_name ? (
              <span className="inline-flex items-center gap-1.5">
                <Building2 size={13} /> {data.student.university_name}
              </span>
            ) : null}
          </p>
        </div>
        {data ? (
          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="font-display text-[44px] font-bold leading-none tracking-[-0.04em] tabular-nums">
                <CountUp to={data.total} />
              </p>
              <p className="mt-1 text-[12px] text-muted">
                belts held
                {data.change ? (
                  <span
                    className={`ml-1.5 font-semibold ${data.change > 0 ? "text-success-text" : "text-brand-text"}`}
                  >
                    {data.change > 0 ? `+${data.change}` : data.change} latest
                  </span>
                ) : null}
              </p>
            </div>
            <div className="rounded-2xl bg-ink px-4 py-3 text-center text-page">
              <p className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.14em] opacity-60">
                <Trophy size={11} /> Rank
              </p>
              <p className="font-display text-[26px] font-bold leading-none tabular-nums">
                {ordinalRank(data.rank.overall)}
              </p>
              <p className="mt-1 text-[10.5px] opacity-60">
                of {data.rank.overall.of}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Student level vs an average, one bar per language. */
function AverageBars({ levels, average }: { levels: Levels; average: Levels }) {
  const reduced = useReducedMotion();
  const max = Math.max(
    1,
    ...LANGUAGES.flatMap((language) => [levels[language], average[language]]),
  );
  return (
    <ul className="space-y-4 px-4 py-4 sm:px-5">
      {LANGUAGES.map((language, index) => {
        const diff = levels[language] - average[language];
        return (
          <li key={language}>
            <div className="flex items-center justify-between gap-3 text-[13px]">
              <span className="inline-flex items-center gap-2 font-semibold text-ink-2">
                <LanguageLogo language={language} size={18} />
                {LANGUAGE_LABELS[language]}
              </span>
              <span className="tabular-nums text-muted">
                <span className="font-display text-[15px] font-bold text-ink">
                  {levels[language]}
                </span>
                <span
                  className={`ml-2 text-[12px] font-semibold ${
                    diff > 0.05
                      ? "text-success-text"
                      : diff < -0.05
                        ? "text-brand-text"
                        : "text-muted"
                  }`}
                >
                  {diff > 0.05 ? "+" : ""}
                  {diff.toFixed(1)} vs avg {average[language].toFixed(1)}
                </span>
              </span>
            </div>
            <div className="relative mt-2 h-2.5 rounded-full bg-sunken">
              <motion.div
                className="h-full rounded-full"
                style={{ background: LANGUAGE_COLORS[language] }}
                initial={reduced ? false : { width: 0 }}
                animate={{ width: `${(levels[language] / max) * 100}%` }}
                transition={{
                  delay: 0.1 + index * 0.08,
                  type: "spring",
                  stiffness: 120,
                  damping: 20,
                }}
              />
              <span
                title={`Average ${average[language].toFixed(2)}`}
                className="absolute -top-1 h-[18px] w-0.5 rounded-full bg-ink"
                style={{ left: `${(average[language] / max) * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
