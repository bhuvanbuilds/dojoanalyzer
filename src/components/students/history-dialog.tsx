"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  CalendarRange,
  Flag,
  History,
  Layers,
  Mail,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CountUp } from "@/components/reactbits/count-up";
import type { Language } from "@/lib/dashboard/metrics";
import { StudentAvatar } from "@/components/students/avatar";
import { beltTotal, type Student } from "@/components/students/types";
import {
  BeltsPanel,
  Empty,
  ProgressPanel,
  WeeklyLog,
  gained,
  recordKey,
  type HistoryResponse,
} from "@/components/students/history-panels";
import {
  OverviewPanels,
  useStudentOverview,
} from "@/components/students/student-overview";


type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: HistoryResponse };

type Tab = "belts" | "progress" | "weeks";

/** What the caller already knows (e.g. a leaderboard row), shown instantly. */
export type ProfileSnapshot = {
  rank?: number;
  score?: number;
  scoreLabel?: string;
  change?: number;
  levels?: Partial<Record<Language, number>>;
};

/**
 * A student in a dialog. Staff get the full history (stats, chart, weekly
 * log); students get the public overview: belts and the growth graph.
 */
export function HistoryDialog({
  student,
  onClose,
  snapshot,
  canViewHistory = true,
}: {
  student: Student | null;
  onClose: () => void;
  snapshot?: ProfileSnapshot;
  /** Students can't open other students' history; they get belts only. */
  canViewHistory?: boolean;
}) {
  // Keep the last student while the dialog animates out.
  const [shown, setShown] = useState(student);
  if (student && student !== shown) setShown(student);
  return (
    <Dialog
      open={Boolean(student)}
      onClose={onClose}
      title="Student history"
      size="xl"
      header={
        shown ? (
          <HistoryHeader
            student={shown}
            snapshot={snapshot}
            canViewHistory={canViewHistory}
          />
        ) : null
      }
    >
      {shown ? (
        canViewHistory ? (
          <HistoryBody
            key={shown.id}
            studentId={shown.id}
            snapshot={snapshot}
          />
        ) : (
          <OverviewBody key={shown.id} studentId={shown.id} />
        )
      ) : null}
    </Dialog>
  );
}

function HistoryHeader({
  student,
  snapshot,
  canViewHistory,
}: {
  student: Student;
  snapshot?: ProfileSnapshot;
  canViewHistory: boolean;
}) {
  return (
    <div className="relative overflow-hidden border-b border-line px-6 pb-5 pt-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(600px 180px at 0% 0%, color-mix(in srgb, var(--brand) 14%, transparent), transparent 70%), radial-gradient(420px 160px at 100% 0%, color-mix(in srgb, var(--lang-cpp) 14%, transparent), transparent 70%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(var(--line-strong)_1px,transparent_1px)] [background-size:14px_14px] [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />
      <div className="relative flex flex-wrap items-center gap-4 pr-8">
        <div className="relative">
          <span
            aria-hidden="true"
            className="dojo-anim absolute -inset-1 animate-[spin_8s_linear_infinite] rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, var(--brand), transparent 40%, var(--lang-cpp), transparent 80%, var(--brand))",
            }}
          />
          <span className="relative block rounded-full bg-surface p-0.5">
            <StudentAvatar
              id={student.id}
              name={student.name}
              email={student.email}
              size={56}
            />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-text">
            <History size={11} /> Dojo profile
            {snapshot?.rank ? (
              <span className="ml-1 rounded-full bg-ink px-2 py-0.5 text-[10.5px] tracking-normal text-page">
                Rank #{snapshot.rank}
              </span>
            ) : null}
          </p>
          <h2 className="truncate font-display text-[22px] font-bold tracking-[-0.025em]">
            {student.name ?? "Unnamed student"}
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
            {student.email ? (
              <span className="inline-flex items-center gap-1">
                <Mail size={12} /> {student.email}
              </span>
            ) : null}
            {student.squad_number ? (
              <span className="rounded-full border border-line bg-surface px-2 py-px font-semibold text-ink-2">
                Squad {student.squad_number}
              </span>
            ) : null}
            {student.university_name ? (
              <span>{student.university_name}</span>
            ) : null}
          </p>
        </div>
        {snapshot?.score !== undefined ? (
          <div className="text-right">
            <p className="font-display text-[30px] font-bold leading-none tracking-[-0.03em] tabular-nums">
              {snapshot.score}
            </p>
            <p className="text-[11.5px] text-muted">
              {snapshot.scoreLabel ?? "belts"}
              {snapshot.change ? (
                <span className="ml-1 font-semibold text-success-text">
                  {snapshot.change > 0
                    ? `+${snapshot.change}`
                    : snapshot.change}{" "}
                  this week
                </span>
              ) : null}
            </p>
          </div>
        ) : null}
        <Link
          href={
            canViewHistory
              ? `/students/${student.id}/history`
              : `/student/${student.id}`
          }
          className="inline-flex items-center gap-1 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-[12px] font-semibold text-ink-2 transition hover:border-ink/40 hover:text-ink"
        >
          {canViewHistory ? "Full page" : "Open profile"}{" "}
          <ArrowUpRight size={13} />
        </Link>
      </div>
    </div>
  );
}

function HistoryBody({
  studentId,
  snapshot,
}: {
  studentId: string;
  snapshot?: ProfileSnapshot;
}) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [tab, setTab] = useState<Tab>("belts");
  const reduced = useReducedMotion();

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(`/api/students/${studentId}/history`, {
          signal: controller.signal,
        });
        const result = (await response.json()) as HistoryResponse & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(result.error ?? "Unable to load student history.");
        setLoad({ status: "ready", data: result });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setLoad({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load student history.",
        });
      }
    })();
    return () => controller.abort();
  }, [studentId]);

  if (load.status === "loading") return <HistorySkeleton />;
  if (load.status === "error")
    return (
      <div className="px-6 py-14 text-center">
        <p className="font-display text-lg font-bold">Couldn’t load history</p>
        <p className="mt-1 text-sm text-muted">{load.message}</p>
      </div>
    );

  const { data } = load;
  const records = [...data.weeklyRecords].sort(
    (a, b) => recordKey(a) - recordKey(b),
  );
  const latest = records.at(-1);
  const totalGained = records.reduce((sum, record) => sum + gained(record), 0);
  const current = beltTotal(latest?.final_belt_levels);
  const promotedWeeks = records.filter((record) => gained(record) > 0).length;

  const stats = [
    { label: "Weeks tracked", value: records.length, icon: CalendarRange },
    { label: "Belts gained", value: totalGained, icon: TrendingUp },
    { label: "Current belt total", value: current, icon: Layers },
    { label: "Weeks promoted", value: promotedWeeks, icon: Flag },
  ];

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "belts", label: "Belts" },
    { id: "progress", label: "Progress" },
    { id: "weeks", label: "Weekly log", count: records.length },
  ];

  return (
    <div className="px-6 pb-6 pt-5">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="rounded-2xl border border-line bg-surface-2 p-3.5"
          >
            <stat.icon size={15} className="text-muted" />
            <p className="mt-2.5 font-display text-[24px] font-bold leading-none tracking-[-0.03em] tabular-nums">
              <CountUp to={stat.value} duration={0.9} />
            </p>
            <p className="mt-1 text-[11.5px] text-muted">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <div
        role="tablist"
        aria-label="History sections"
        className="mt-5 inline-flex rounded-xl border border-line bg-sunken p-1"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`relative rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${tab === item.id ? "text-ink" : "text-muted hover:text-ink-2"}`}
          >
            {tab === item.id ? (
              <motion.span
                layoutId="history-tab"
                className="absolute inset-0 rounded-lg bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            ) : null}
            <span className="relative">
              {item.label}
              {item.count !== undefined ? (
                <span className="ml-1.5 text-[11px] text-faint">
                  {item.count}
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="mt-4"
        >
          {tab === "belts" ? (
            <BeltsPanel
              levels={
                (latest?.final_belt_levels as Partial<
                  Record<Language, number>
                > | null) ?? snapshot?.levels
              }
              previous={
                latest?.initial_belt_levels as Partial<
                  Record<Language, number>
                > | null
              }
            />
          ) : tab === "progress" ? (
            <ProgressPanel
              records={records}
              latest={latest}
              promotedWeeks={promotedWeeks}
            />
          ) : (
            <WeeklyLog records={records} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="px-6 pb-6 pt-5" aria-busy="true">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-line p-3.5">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="mt-3 h-6 w-12" />
            <Skeleton className="mt-2 h-2.5 w-20" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-5 h-9 w-64 rounded-xl" />
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-line p-4">
          <Skeleton className="h-4 w-40" />
          <div className="mt-4 flex h-48 items-end gap-2">
            {[40, 55, 48, 70, 62, 80, 76, 92].map((h, i) => (
              <Skeleton
                key={i}
                className="flex-1 rounded-md"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
        <div className="space-y-4 rounded-2xl border border-line p-4">
          <Skeleton className="h-4 w-32" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** What a student sees about another student: belts and the growth graph. */
function OverviewBody({ studentId }: { studentId: string }) {
  const load = useStudentOverview(studentId);
  if (load.status === "loading") return <HistorySkeleton />;
  if (load.status !== "ready")
    return (
      <div className="px-6 py-14">
        <Empty
          message={
            load.status === "error"
              ? load.message
              : "This student isn’t ranked yet."
          }
        />
      </div>
    );
  return (
    <div className="divide-y divide-line border-t border-line">
      <OverviewPanels data={load.data} />
    </div>
  );
}
