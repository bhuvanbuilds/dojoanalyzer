"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Mail,
  School,
  Users,
} from "lucide-react";
import {
  getCurrentUserProfile,
  type CurrentUserProfile,
} from "@/lib/auth/profile";
import {
  PageState as AccountState,
  PanelSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";
import {
  Cell,
  Cells,
  Frame,
  FrameMessage,
  Page,
  Panel,
  Split,
} from "@/components/ui/frame";
import { CountUp } from "@/components/reactbits/count-up";
import { StudentAvatar } from "@/components/students/avatar";
import { LanguageLogo } from "@/components/belts/belts";
import { LANGUAGE_COLORS } from "@/components/dashboard/chart-kit";
import {
  BeltsPanel,
  ProgressPanel,
  SquadTimeline,
  gained,
  recordKey,
  type HistoryResponse,
  type WeeklyRecord,
} from "@/components/students/history-dialog";
import {
  beltTotal,
  formatDate,
  type Student,
} from "@/components/students/types";
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  type Language,
} from "@/lib/dashboard/metrics";
import { useCachedProfile } from "@/lib/auth/use-cached-profile";

type LeaderboardRow = {
  rank: number;
  student_id: string;
  university_id: string | null;
  squad_number: string | null;
  language_belts: Record<Language, number>;
  total_belts_earned: number;
  change: number;
};

type Roster = {
  /** Students the viewer can see, A–Z: the order prev/next walks through. */
  students: Student[];
  leaderboard: LeaderboardRow[];
};

// Shared across student-to-student navigation so prev/next doesn't refetch.
let rosterCache: Promise<Roster> | null = null;

function loadRoster(): Promise<Roster> {
  rosterCache ??= Promise.all([
    fetch("/api/students").then((response) =>
      response.ok ? response.json() : { students: [] },
    ),
    fetch("/api/leaderboard/overall").then((response) =>
      response.ok ? response.json() : { leaderboard: [] },
    ),
  ])
    .then(
      ([studentsResult, leaderboardResult]: [
        { students?: Student[] },
        { leaderboard?: LeaderboardRow[] },
      ]) => ({
        students: [...(studentsResult.students ?? [])].sort((a, b) =>
          (a.name ?? "").localeCompare(b.name ?? ""),
        ),
        leaderboard: leaderboardResult.leaderboard ?? [],
      }),
    )
    .catch((error) => {
      rosterCache = null;
      throw error;
    });
  return rosterCache;
}

type HistoryLoad =
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "error"; message: string }
  | { status: "ready"; data: HistoryResponse };

export default function StudentHistoryPage() {
  const router = useRouter();
  const params = useParams<{ studentId: string }>();
  const studentId = params.studentId;
  const cachedProfile = useCachedProfile();
  const [profileState, setProfileState] = useState<
    CurrentUserProfile | { status: "loading" }
  >(cachedProfile ?? { status: "loading" });
  const [roster, setRoster] = useState<Roster | null>(null);
  const [history, setHistory] = useState<HistoryLoad & { studentId?: string }>({
    status: "loading",
  });

  const canView =
    profileState.status === "authenticated" &&
    profileState.profile.role !== "student";

  useEffect(() => {
    let isMounted = true;
    getCurrentUserProfile().then((result) => {
      if (isMounted) setProfileState(result);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (profileState.status === "unauthenticated") router.replace("/login");
    if (
      profileState.status === "authenticated" &&
      profileState.profile.role === "student"
    )
      router.replace("/student");
  }, [profileState, router]);

  useEffect(() => {
    if (!canView) return;
    let isMounted = true;
    loadRoster()
      .then((result) => {
        if (isMounted) setRoster(result);
      })
      .catch(() => undefined);
    return () => {
      isMounted = false;
    };
  }, [canView]);

  useEffect(() => {
    if (!canView || !studentId) return;
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(`/api/students/${studentId}/history`, {
          signal: controller.signal,
        });
        const result = (await response.json()) as HistoryResponse & {
          error?: string;
        };
        if (response.status === 404) {
          setHistory({ status: "not_found", studentId });
          return;
        }
        if (!response.ok)
          throw new Error(result.error ?? "Unable to load student history.");
        setHistory({ status: "ready", data: result, studentId });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setHistory({
          status: "error",
          studentId,
          message:
            error instanceof Error
              ? error.message
              : "Unable to load student history.",
        });
      }
    })();
    return () => controller.abort();
  }, [canView, studentId]);

  // Position of this student in the A–Z roster, for prev / next.
  const position = useMemo(() => {
    const list = roster?.students ?? [];
    const index = list.findIndex((student) => student.id === studentId);
    if (index < 0) return null;
    return {
      index,
      total: list.length,
      student: list[index],
      prev: list[(index - 1 + list.length) % list.length],
      next: list[(index + 1) % list.length],
    };
  }, [roster, studentId]);

  // ← / → step through students, unless the user is typing.
  useEffect(() => {
    if (!position || position.total < 2) return;
    const { prev, next } = position;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target?.closest("input, textarea, select, [contenteditable='true']")
      )
        return;
      if (event.key === "ArrowLeft") router.push(historyHref(prev.id));
      if (event.key === "ArrowRight") router.push(historyHref(next.id));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [position, router]);

  if (profileState.status === "loading")
    return <AccountState message="Checking your account..." loading />;
  if (profileState.status === "unauthenticated")
    return <AccountState message="Redirecting to login..." loading />;
  if (profileState.status === "unassigned")
    return (
      <AccountState
        message="Account not assigned"
        detail="Your account does not have an assigned profile yet."
      />
    );
  if (profileState.status === "invalid_role")
    return <AccountState message="Account role not supported" />;
  if (profileState.status === "error")
    return (
      <AccountState
        message="Unable to load your account"
        detail={profileState.message}
      />
    );
  if (!canView)
    return (
      <AccountState message="Redirecting to your student area..." loading />
    );

  // A response for the previous student is stale while the next one loads.
  const current: HistoryLoad =
    history.studentId === studentId ? history : { status: "loading" };
  const data = current.status === "ready" ? current.data : null;
  const rosterStudent = position?.student ?? null;
  const ranking =
    roster?.leaderboard.find((row) => row.student_id === studentId) ?? null;

  return (
    <Page>
      <Frame>
        <ProfileNav position={position} />
        <Hero
          studentId={studentId}
          name={data?.student.name ?? rosterStudent?.name ?? null}
          email={data?.student.email ?? rosterStudent?.email ?? null}
          squad={rosterStudent?.squad_number ?? ranking?.squad_number ?? null}
          university={rosterStudent?.university_name ?? null}
          since={rosterStudent?.start_date ?? null}
          ranking={ranking}
          rankedCount={roster?.leaderboard.length ?? 0}
          loading={current.status === "loading"}
        />
        {current.status === "loading" ? (
          <PanelSkeleton rows={6} label="Loading student profile" flat />
        ) : current.status === "not_found" ? (
          <FrameMessage title="Student not found">
            This student is not part of your university.
          </FrameMessage>
        ) : current.status === "error" ? (
          <FrameMessage title="Unable to load history">
            {current.message}
          </FrameMessage>
        ) : (
          <ProfileBody
            data={current.data}
            ranking={ranking}
            leaderboard={roster?.leaderboard ?? []}
          />
        )}
      </Frame>
    </Page>
  );
}

function historyHref(id: string) {
  return `/students/${id}/history`;
}

// ─── Prev / next strip ────────────────────────────────────────────────────────
function ProfileNav({
  position,
}: {
  position: {
    index: number;
    total: number;
    prev: Student;
    next: Student;
  } | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 bg-surface-2 px-3 py-2 sm:px-4">
      <Link
        href="/students"
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-ink-2 transition hover:bg-ink/5 hover:text-ink"
      >
        <ArrowLeft size={15} /> Students
      </Link>
      {position && position.total > 1 ? (
        <div className="flex items-center gap-2">
          <span className="hidden text-[12.5px] tabular-nums text-muted sm:inline">
            <span className="font-semibold text-ink">{position.index + 1}</span>{" "}
            of {position.total}
          </span>
          <StepLink student={position.prev} direction="prev" />
          <StepLink student={position.next} direction="next" />
        </div>
      ) : null}
    </div>
  );
}

function StepLink({
  student,
  direction,
}: {
  student: Student;
  direction: "prev" | "next";
}) {
  const label = student.name ?? "Unnamed student";
  return (
    <Link
      href={historyHref(student.id)}
      aria-label={`${direction === "prev" ? "Previous" : "Next"} student: ${label}`}
      title={`${label} (${direction === "prev" ? "←" : "→"})`}
      className={`group inline-flex h-9 max-w-[220px] items-center gap-2 rounded-full border border-line-strong bg-surface text-[13px] font-semibold text-ink-2 transition hover:border-ink/40 hover:text-ink ${
        direction === "prev" ? "pl-2 pr-3.5" : "flex-row-reverse pl-3.5 pr-2"
      }`}
    >
      {direction === "prev" ? (
        <ChevronLeft
          size={16}
          className="shrink-0 transition group-hover:-translate-x-0.5"
        />
      ) : (
        <ChevronRight
          size={16}
          className="shrink-0 transition group-hover:translate-x-0.5"
        />
      )}
      <StudentAvatar id={student.id} name={student.name} size={22} />
      <span className="hidden truncate md:inline">{label}</span>
      <span className="md:hidden">
        {direction === "prev" ? "Prev" : "Next"}
      </span>
    </Link>
  );
}

// ─── Identity hero ────────────────────────────────────────────────────────────
function Hero({
  studentId,
  name,
  email,
  squad,
  university,
  since,
  ranking,
  rankedCount,
  loading,
}: {
  loading: boolean;
  studentId: string;
  name: string | null;
  email: string | null;
  squad: string | null;
  university: string | null;
  since: string | null;
  ranking: LeaderboardRow | null;
  rankedCount: number;
}) {
  return (
    <section className="relative overflow-hidden px-4 py-6 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(700px 220px at 0% 0%, color-mix(in srgb, var(--brand) 13%, transparent), transparent 70%), radial-gradient(520px 200px at 100% 0%, color-mix(in srgb, var(--lang-cpp) 12%, transparent), transparent 70%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(var(--line-strong)_1px,transparent_1px)] [background-size:14px_14px] [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />
      <div className="relative flex flex-wrap items-center gap-5">
        <div className="relative shrink-0">
          <span
            aria-hidden="true"
            className="dojo-anim absolute -inset-1 animate-[spin_8s_linear_infinite] rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, var(--brand), transparent 40%, var(--lang-cpp), transparent 80%, var(--brand))",
            }}
          />
          <span className="relative block rounded-full bg-surface p-1">
            <StudentAvatar id={studentId} name={name} email={email} size={84} />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-text">
            Student profile
          </p>
          {!name && loading ? (
            <Skeleton className="mt-2 h-8 w-56 max-w-full" />
          ) : (
            <h1 className="mt-0.5 truncate font-display text-[28px] font-bold leading-tight tracking-[-0.03em] sm:text-[34px]">
              {name ?? "Unnamed student"}
            </h1>
          )}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-muted">
            {email ? (
              <span className="inline-flex items-center gap-1.5">
                <Mail size={13} /> {email}
              </span>
            ) : null}
            {squad ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-0.5 font-semibold text-ink-2">
                <Users size={12} /> Squad {squad}
              </span>
            ) : null}
            {university ? (
              <span className="inline-flex items-center gap-1.5">
                <School size={13} /> {university}
              </span>
            ) : null}
            {since ? <span>Member since {formatDate(since)}</span> : null}
          </p>
        </div>
        {ranking ? (
          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="font-display text-[44px] font-bold leading-none tracking-[-0.04em] tabular-nums">
                <CountUp to={ranking.total_belts_earned} />
              </p>
              <p className="mt-1 text-[12px] text-muted">
                belts held
                {ranking.change ? (
                  <span
                    className={`ml-1.5 font-semibold ${ranking.change > 0 ? "text-success-text" : "text-brand-text"}`}
                  >
                    {ranking.change > 0 ? `+${ranking.change}` : ranking.change}{" "}
                    this week
                  </span>
                ) : null}
              </p>
            </div>
            <div className="rounded-2xl bg-ink px-4 py-3 text-center text-page">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] opacity-60">
                Rank
              </p>
              <p className="font-display text-[26px] font-bold leading-none tabular-nums">
                #{ranking.rank}
              </p>
              {rankedCount ? (
                <p className="mt-1 text-[10.5px] opacity-60">
                  of {rankedCount}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

// ─── Body ─────────────────────────────────────────────────────────────────────
function ProfileBody({
  data,
  ranking,
  leaderboard,
}: {
  data: HistoryResponse;
  ranking: LeaderboardRow | null;
  leaderboard: LeaderboardRow[];
}) {
  const records = [...data.weeklyRecords].sort(
    (a, b) => recordKey(a) - recordKey(b),
  );
  const latest = records.at(-1);
  const totalGained = records.reduce((sum, record) => sum + gained(record), 0);
  const promotedWeeks = records.filter((record) => gained(record) > 0).length;
  const currentTotal = beltTotal(latest?.final_belt_levels);
  const levels =
    (latest?.final_belt_levels as Partial<Record<Language, number>> | null) ??
    ranking?.language_belts ??
    null;

  const squadPeers = ranking?.squad_number
    ? leaderboard.filter(
        (row) =>
          row.squad_number === ranking.squad_number &&
          row.university_id === ranking.university_id,
      )
    : [];
  const squadRank = ranking
    ? squadPeers.filter(
        (row) => row.total_belts_earned > ranking.total_belts_earned,
      ).length + 1
    : null;

  const stats = [
    {
      label: "Belts held",
      value: currentTotal,
      hint: latest ? `As of week ${latest.week_number ?? "?"}` : "No records",
    },
    {
      label: "Belts gained",
      value: totalGained,
      hint: `Across ${records.length} tracked ${records.length === 1 ? "week" : "weeks"}`,
    },
    {
      label: "Promotion rate",
      value: records.length ? (promotedWeeks / records.length) * 100 : 0,
      suffix: "%",
      hint: `Promoted in ${promotedWeeks} of ${records.length} weeks`,
    },
    {
      label: "Avg gain / week",
      value: records.length ? totalGained / records.length : 0,
      decimals: 2,
      hint: "Belts earned per tracked week",
    },
    {
      label: "Squad rank",
      value: squadRank ?? 0,
      prefix: squadRank ? "#" : "",
      hint: squadPeers.length
        ? `Among ${squadPeers.length} in Squad ${ranking?.squad_number}`
        : "No squad ranking",
    },
    {
      label: "Squads joined",
      value: data.memberships.length,
      hint: data.memberships.some((membership) => !membership.end_date)
        ? "Currently active"
        : "No active squad",
    },
  ];

  return (
    <>
      <Cells className="grid-cols-2 md:grid-cols-3 2xl:grid-cols-6">
        {stats.map((stat) => (
          <Cell key={stat.label} className="px-4 py-4 sm:px-5">
            <p className="text-[12.5px] font-medium text-muted">{stat.label}</p>
            <p className="mt-1.5 font-display text-[28px] font-bold leading-none tracking-[-0.03em] tabular-nums">
              <CountUp
                to={stat.value}
                decimals={stat.decimals ?? 0}
                prefix={stat.prefix}
              />
              {stat.suffix ? (
                <span className="text-[18px] text-faint">{stat.suffix}</span>
              ) : null}
            </p>
            <p className="mt-1.5 text-[11.5px] text-muted">{stat.hint}</p>
          </Cell>
        ))}
      </Cells>

      <BeltsPanel
        levels={levels}
        previous={
          latest?.initial_belt_levels as Partial<
            Record<Language, number>
          > | null
        }
        flat
      />

      {records.length ? (
        <ProgressPanel
          records={records}
          latest={latest}
          promotedWeeks={promotedWeeks}
          flat
        />
      ) : null}

      <Split className="xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel
          title="Compared with peers"
          description={
            squadPeers.length
              ? `Squad ${ranking?.squad_number} average and everyone ranked`
              : "Average of everyone ranked"
          }
        >
          <PeerComparison
            levels={levels}
            squad={squadPeers}
            everyone={leaderboard}
          />
        </Panel>
        <Panel title="Squad history">
          <div className="px-4 py-4 sm:px-5">
            <SquadTimeline memberships={data.memberships} />
          </div>
        </Panel>
      </Split>

      <Panel
        title="Weekly log"
        description={`${records.length} ${records.length === 1 ? "week" : "weeks"} of belt tests, newest first`}
      >
        <WeeklyTable records={records} />
      </Panel>
    </>
  );
}

function average(rows: LeaderboardRow[], language: Language) {
  if (!rows.length) return null;
  return (
    rows.reduce((sum, row) => sum + (row.language_belts[language] ?? 0), 0) /
    rows.length
  );
}

/** Student level vs squad and overall average, one track per language. */
function PeerComparison({
  levels,
  squad,
  everyone,
}: {
  levels: Partial<Record<Language, number>> | null;
  squad: LeaderboardRow[];
  everyone: LeaderboardRow[];
}) {
  const reduced = useReducedMotion();
  const rows = LANGUAGES.map((language) => ({
    language,
    level: levels?.[language] ?? 0,
    squad: average(squad, language),
    everyone: average(everyone, language),
  }));
  const max = Math.max(
    1,
    ...rows.flatMap((row) => [row.level, row.squad ?? 0, row.everyone ?? 0]),
  );

  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-ink-2" /> This student
        </span>
        {squad.length ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-0.5 bg-brand" /> Squad average
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-0.5 border-l-2 border-dashed border-faint" />{" "}
          Everyone
        </span>
      </div>
      <ul className="space-y-4">
        {rows.map((row, index) => {
          const ahead =
            row.squad !== null
              ? row.level - row.squad
              : row.level - (row.everyone ?? 0);
          return (
            <li key={row.language}>
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="inline-flex items-center gap-2 font-semibold text-ink-2">
                  <LanguageLogo language={row.language} size={18} />
                  {LANGUAGE_LABELS[row.language]}
                </span>
                <span className="tabular-nums text-muted">
                  <span className="font-display text-[15px] font-bold text-ink">
                    {row.level}
                  </span>
                  <span
                    className={`ml-2 text-[12px] font-semibold ${
                      ahead > 0.05
                        ? "text-success-text"
                        : ahead < -0.05
                          ? "text-brand-text"
                          : "text-muted"
                    }`}
                  >
                    {ahead > 0.05 ? "+" : ""}
                    {ahead.toFixed(1)} vs {row.squad !== null ? "squad" : "avg"}
                  </span>
                </span>
              </div>
              <div className="relative mt-2 h-2.5 rounded-full bg-sunken">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: LANGUAGE_COLORS[row.language] }}
                  initial={reduced ? false : { width: 0 }}
                  animate={{ width: `${(row.level / max) * 100}%` }}
                  transition={{
                    delay: 0.1 + index * 0.08,
                    type: "spring",
                    stiffness: 120,
                    damping: 20,
                  }}
                />
                {row.squad !== null ? (
                  <span
                    title={`Squad average ${row.squad.toFixed(2)}`}
                    className="absolute -top-1 h-[18px] w-0.5 rounded-full bg-brand"
                    style={{ left: `${(row.squad / max) * 100}%` }}
                  />
                ) : null}
                {row.everyone !== null ? (
                  <span
                    title={`Average of everyone ${row.everyone.toFixed(2)}`}
                    className="absolute -top-1 h-[18px] border-l-2 border-dashed border-faint"
                    style={{ left: `${(row.everyone / max) * 100}%` }}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatTimestamp(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

/** Every weekly record as a ruled table: before → after per language. */
function WeeklyTable({ records }: { records: WeeklyRecord[] }) {
  if (!records.length)
    return (
      <p className="px-4 py-12 text-center text-sm text-muted sm:px-5">
        No weekly belt records are available for this student.
      </p>
    );
  const newestFirst = [...records].reverse();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-[13px]">
        <thead className="border-b border-line bg-surface-2 text-[11px] uppercase tracking-[0.08em] text-muted">
          <tr>
            <th className="px-4 py-2.5 font-semibold sm:px-5">Week</th>
            {LANGUAGES.map((language) => (
              <th key={language} className="px-3 py-2.5 font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <LanguageLogo language={language} size={14} />
                  {LANGUAGE_LABELS[language]}
                </span>
              </th>
            ))}
            <th className="px-3 py-2.5 text-right font-semibold">Gained</th>
            <th className="px-4 py-2.5 font-semibold sm:px-5">Tested</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {newestFirst.map((record, index) => {
            const delta = gained(record);
            return (
              <tr
                key={`${recordKey(record)}-${record.start_time}-${index}`}
                className="transition-colors hover:bg-surface-2"
              >
                <td className="px-4 py-3 sm:px-5">
                  <p className="font-display font-semibold text-ink">
                    Week {record.week_number ?? "?"}
                  </p>
                  <p className="text-[11.5px] text-muted">
                    {record.academic_year ?? ""}
                  </p>
                </td>
                {LANGUAGES.map((language) => {
                  const before = record.initial_belt_levels?.[language];
                  const after = record.final_belt_levels?.[language];
                  const up =
                    typeof before === "number" &&
                    typeof after === "number" &&
                    after > before;
                  return (
                    <td key={language} className="px-3 py-3 tabular-nums">
                      <span className="text-muted">{before ?? "—"}</span>
                      <span className="mx-1.5 text-faint">→</span>
                      <span
                        className={`font-bold ${up ? "text-success-text" : "text-ink"}`}
                      >
                        {after ?? "—"}
                      </span>
                    </td>
                  );
                })}
                <td className="px-3 py-3 text-right">
                  {delta > 0 ? (
                    <span className="rounded-full bg-success-soft px-2 py-0.5 text-[12px] font-bold tabular-nums text-success-text">
                      +{delta}
                    </span>
                  ) : (
                    <span className="text-faint">0</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-muted sm:px-5">
                  {formatTimestamp(
                    record.belt_test_updated_at ?? record.start_time,
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
