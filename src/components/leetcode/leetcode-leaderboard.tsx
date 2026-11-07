"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Award, Building2, Check, Crown, Flame, Globe2, Info, Search, Users, X, Zap } from "lucide-react";
import { LightRays } from "@/components/reactbits/light-rays";
import { Embers } from "@/components/fx/embers";
import { LiquidGlass } from "@/components/fx/liquid-glass";
import { RevealText } from "@/components/fx/reveal-text";
import { CountUp } from "@/components/reactbits/count-up";
import { SelectBox } from "@/components/leaderboard/board";
import { Frame, Page } from "@/components/ui/frame";
import { Avatar } from "@/components/leetcode/leetcode-card";
import { Heatmap } from "@/components/leetcode/heatmap";
import { LeetCodeLogo, LEETCODE_ORANGE } from "@/components/leetcode/leetcode-logo";
import { ProfileLinks, type ProfileLinksData } from "@/components/students/profile-links";
import { getCurrentUserProfile, type CurrentUserProfile } from "@/lib/auth/profile";
import { useCachedProfile } from "@/lib/auth/use-cached-profile";
import { DAILY_BONUS, POINTS } from "@/lib/gamification";
import { istDay } from "@/lib/leetcode";

type Period = "week" | "month" | "all";
type Today = "done" | "pending";
type Row = {
  rank: number;
  student_id: string;
  name: string;
  squad_number: string;
  university_name: string | null;
  username: string;
  avatar_url: string | null;
  points: number;
  solved: { easy: number; medium: number; hard: number };
  daily: number;
  badges: number;
  isMe: boolean;
  /** LeetCode submissions per IST day, last 26 weeks. */
  activity_days: Record<string, number>;
  total_solved: number | null;
  streak: number | null;
  solved_today: number;
  links: ProfileLinksData;
};
type University = { id: string; name: string };
type Squad = { id: string; squad_number: string; university_id: string };
type Viewer = { student_id: string | null; university_id: string | null; squad_id: string | null };
type Response = {
  rows?: Row[];
  unlinked?: number;
  total?: number;
  today?: { done: number; pending: number };
  universities?: University[];
  squads?: Squad[];
  viewer?: Viewer;
  error?: string;
};

const PERIODS: Array<[Period, string]> = [
  ["week", "This week"],
  ["month", "This month"],
  ["all", "All time"],
];
const MEDAL = ["#F5C451", "#C9D1D9", "#D08A57"];
const DONE = "#22c55e";
const PENDING = "#ef4444";

/**
 * LeetCode points leaderboard: podium for the top three, then a card per
 * student. Filters work exactly like the belt leaderboards (scope chips,
 * university, squad, period and search, all kept in the URL), plus a
 * "solved today" filter. Every role sees every campus.
 */
export function LeetCodeLeaderboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cachedProfile = useCachedProfile();
  const [loadedProfile, setLoadedProfile] = useState<CurrentUserProfile | null>(null);
  useEffect(() => {
    let active = true;
    getCurrentUserProfile()
      .then((result) => active && setLoadedProfile(result))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  const account = loadedProfile ?? cachedProfile;
  const ready = account?.status === "authenticated";

  const universityId = searchParams.get("university") ?? "";
  const squadId = searchParams.get("squad") ?? "";
  const askedPeriod = searchParams.get("period");
  const period: Period = askedPeriod === "month" || askedPeriod === "all" ? askedPeriod : "week";
  const askedToday = searchParams.get("today");
  const today: Today | "" = askedToday === "done" || askedToday === "pending" ? askedToday : "";
  const search = searchParams.get("q") ?? "";
  const [searchInput, setSearchInput] = useState(search);

  // Each filter change is its own history entry; typing replaces the entry.
  function setParams(next: Record<string, string | null>, { replace = false } = {}) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }

  // Debounce typing into the URL.
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === search) return;
    const timeout = window.setTimeout(() => setParams({ q: trimmed || null }, { replace: true }), 300);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setParams reads the live URL
  }, [searchInput, search]);

  const requestKey = useMemo(() => {
    const query = new URLSearchParams({ period });
    if (universityId) query.set("university_id", universityId);
    if (squadId) query.set("squad_id", squadId);
    if (search) query.set("search", search);
    if (today) query.set("today", today);
    return `/api/leetcode/leaderboard?${query}`;
  }, [period, universityId, squadId, search, today]);

  const [data, setData] = useState<Response | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    fetch(requestKey, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as Response;
        if (!response.ok) throw new Error(result.error ?? "Couldn’t load the leaderboard.");
        setData(result);
        setError("");
        setLoadedKey(requestKey);
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Couldn’t load the leaderboard.");
        setLoadedKey(requestKey);
      });
    return () => controller.abort();
  }, [ready, requestKey]);

  const [day] = useState(() => istDay());
  const isLoading = loadedKey !== requestKey;
  const rows = isLoading ? null : (data?.rows ?? []);
  const top = (rows ?? []).slice(0, 3);
  const rest = (rows ?? []).slice(3);
  const me = (rows ?? []).find((row) => row.isMe);
  const universities = data?.universities ?? [];
  const squads = data?.squads ?? [];
  const viewer = data?.viewer ?? null;
  const universityName = new Map(universities.map((u) => [u.id, u.name]));
  const squad = squads.find((item) => item.id === squadId) ?? null;
  const visibleSquads = universityId ? squads.filter((item) => item.university_id === universityId) : squads;
  const scopeLabel = squad
    ? `Squad ${squad.squad_number}`
    : universityId
      ? (universityName.get(universityId) ?? "University")
      : "All universities";

  const scopes: Array<{ id: string; label: string; icon: typeof Globe2; active: boolean; apply: Record<string, string | null> }> = [
    { id: "all", label: "Everyone", icon: Globe2, active: !universityId && !squadId, apply: { university: null, squad: null } },
  ];
  if (viewer?.university_id)
    scopes.push({
      id: "campus",
      label: "My campus",
      icon: Building2,
      active: universityId === viewer.university_id && !squadId,
      apply: { university: viewer.university_id, squad: null },
    });
  if (viewer?.squad_id)
    scopes.push({
      id: "squad",
      label: "My squad",
      icon: Users,
      active: squadId === viewer.squad_id,
      apply: { university: viewer.university_id, squad: viewer.squad_id },
    });

  const todayChips: Array<{ id: Today | ""; label: string; count?: number; dot?: string }> = [
    { id: "", label: "Everyone" },
    { id: "done", label: "Solved today", count: data?.today?.done, dot: DONE },
    { id: "pending", label: "Not yet today", count: data?.today?.pending, dot: PENDING },
  ];

  const filtered = Boolean(search || universityId || squadId || today);

  return (
    <Page className="pb-24">
      <Frame>
        <section data-tour="lc-hero" className="relative isolate overflow-hidden bg-[#0b0b0e] text-white [&]:rounded-t-[11px]">
          <div aria-hidden="true" className="absolute inset-0">
            <LightRays raysOrigin="top-center" raysColor="#ffcf8a" raysSpeed={0.8} lightSpread={0.85} rayLength={1.5} fadeDistance={1.1} followMouse mouseInfluence={0.06} noiseAmount={0.05} distortion={0.04} />
          </div>
          <Embers density={0.9} />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0b0b0e] to-transparent" />
          <div className="relative px-6 pt-8 text-center sm:px-10 sm:pt-10">
            <p className="inline-flex items-center gap-2 text-[13px] font-medium text-white/60">
              <LeetCodeLogo size={15} /> LeetCode · {scopeLabel} · {PERIODS.find(([value]) => value === period)?.[1]}
            </p>
            <h1 className="mt-2 font-display text-[40px] font-extrabold leading-none tracking-[-0.045em] sm:text-[60px]">
              <RevealText parts={["Problem Solvers"]} />
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-[14px] text-white/60">
              Points for every new problem: Easy {POINTS.Easy}, Medium {POINTS.Medium}, Hard {POINTS.Hard}, plus {DAILY_BONUS} for each daily challenge.
            </p>
          </div>
          <div className="relative px-3 pb-0 pt-6 sm:px-10">
            {rows === null ? (
              <div className="flex h-64 items-center justify-center text-[13px] text-white/50">{error || "Counting points…"}</div>
            ) : rows.length === 0 ? (
              <div className="flex h-56 items-center justify-center px-6 pb-10 text-center text-[14px] text-white/60">
                {filtered ? "No students match these filters." : "No one has linked LeetCode yet. Link yours under Practice → LeetCode to claim the first spot."}
              </div>
            ) : (
              <Podium top={top} />
            )}
          </div>
        </section>

        <div data-tour="lc-controls" className="space-y-3 bg-surface-2 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <ChipGroup label="Scope" tour="lc-scope">
              {scopes.map((scope) => (
                <Chip key={scope.id} active={scope.active} layoutId="lc-scope" onClick={() => setParams(scope.apply)}>
                  <scope.icon size={14} className="relative" />
                  <span className="relative">{scope.label}</span>
                </Chip>
              ))}
            </ChipGroup>
            <ChipGroup label="Solved today" tour="lc-today">
              {todayChips.map((chip) => (
                <Chip key={chip.id || "all"} active={today === chip.id} layoutId="lc-today" onClick={() => setParams({ today: chip.id || null })}>
                  {chip.dot ? <span className="relative h-2 w-2 rounded-full" style={{ background: chip.dot, boxShadow: `0 0 0 3px ${chip.dot}33` }} /> : null}
                  <span className="relative">{chip.label}</span>
                  {chip.count !== undefined ? <span className="relative tabular-nums text-faint">{chip.count}</span> : null}
                </Chip>
              ))}
            </ChipGroup>
            <span className="ml-auto hidden text-[12.5px] text-muted md:inline">
              {isLoading ? "Updating…" : `${rows?.length ?? 0} ranked${data?.unlinked ? ` · ${data.unlinked} haven’t linked LeetCode` : ""}`}
            </span>
          </div>

          <div data-tour="lc-filters" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,220px))_minmax(0,1fr)]">
            <SelectBox label="University" value={universityId} onChange={(value) => setParams({ university: value || null, squad: null })}>
              <option value="">All universities</option>
              {universities.map((university) => (
                <option key={university.id} value={university.id}>
                  {university.name}
                </option>
              ))}
            </SelectBox>
            <SelectBox
              label="Squad"
              value={squadId}
              onChange={(value) => {
                const picked = squads.find((item) => item.id === value);
                setParams({ squad: value || null, university: picked ? picked.university_id : universityId || null });
              }}
            >
              <option value="">All squads</option>
              {visibleSquads.map((item) => (
                <option key={item.id} value={item.id}>
                  Squad {item.squad_number}
                  {universityId ? "" : ` · ${universityName.get(item.university_id) ?? ""}`}
                </option>
              ))}
            </SelectBox>
            <SelectBox label="Period" value={period === "week" ? "" : period} onChange={(value) => setParams({ period: value || null })}>
              {PERIODS.map(([value, label]) => (
                <option key={value} value={value === "week" ? "" : value}>
                  {label}
                </option>
              ))}
            </SelectBox>
            <label className="relative flex items-center">
              <span className="sr-only">Search</span>
              <Search size={15} className="pointer-events-none absolute left-3 text-faint" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search name, campus or squad…"
                className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-9 text-[14px] text-ink outline-none transition placeholder:text-faint hover:border-line-strong focus-visible:ring-2 focus-visible:ring-ink/10"
              />
              {searchInput ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchInput("")}
                  className="absolute right-2 grid h-6 w-6 place-items-center rounded-md text-muted hover:text-ink"
                >
                  <X size={14} />
                </button>
              ) : null}
            </label>
          </div>
        </div>

        {rows && rows.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-2.5 text-[12.5px] text-muted sm:px-5">
              <span className="inline-flex items-center gap-1">
                <Info size={13} /> {period === "all" ? "All time uses LeetCode’s lifetime solved counts." : "Counts new problems tracked since each student linked LeetCode."}
              </span>
            </div>
            {rest.length ? (
              <ol data-tour="lc-cards" className="grid gap-px border-t border-line bg-line lg:grid-cols-2">
                {rest.map((row, index) => (
                  <RankCard key={row.student_id} row={row} index={index} today={day} />
                ))}
              </ol>
            ) : null}
          </>
        ) : null}
      </Frame>

      <AnimatePresence>
        {me && me.rank > 3 ? (
          <motion.div
            initial={{ opacity: 0, y: 20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 20, x: "-50%" }}
            className="fixed bottom-6 left-1/2 z-40"
          >
            <LiquidGlass className="flex items-center gap-3 rounded-full px-5 py-3 font-display text-[14px] font-semibold text-white" style={{ background: "linear-gradient(135deg, rgba(20,20,24,0.72), rgba(20,20,24,0.5))" }}>
              <span className="rounded-full px-2 py-0.5 text-[12px] text-[#0b0b0e]" style={{ background: LEETCODE_ORANGE }}>
                #{me.rank}
              </span>
              You · {me.points} pts
            </LiquidGlass>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Page>
  );
}

function ChipGroup({ label, tour, children }: { label: string; tour: string; children: React.ReactNode }) {
  return (
    <div role="radiogroup" aria-label={label} data-tour={tour} className="flex flex-wrap gap-1 rounded-xl bg-ink/[0.045] p-1">
      {children}
    </div>
  );
}

function Chip({ active, layoutId, onClick, children }: { active: boolean; layoutId: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`relative flex h-8 items-center gap-1.5 rounded-lg px-3 font-display text-[13px] font-semibold transition-colors ${active ? "text-ink" : "text-muted hover:text-ink"}`}
    >
      {active ? (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 rounded-lg bg-surface shadow-[var(--card-shadow)] ring-[0.5px] ring-line"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      ) : null}
      {children}
    </button>
  );
}

/** Avatar with a green (solved a new problem today) or red (not yet) status dot. */
function StatusAvatar({ row, size, ring }: { row: Row; size: number; ring?: string }) {
  const done = row.solved_today > 0;
  const dot = Math.max(11, Math.round(size * 0.26));
  return (
    <span className="relative inline-block shrink-0">
      <span className="block rounded-full p-[2.5px]" style={{ background: ring ?? (done ? DONE : PENDING) }}>
        <Avatar name={row.name} src={row.avatar_url} size={size} />
      </span>
      <span
        title={done ? "Solved a new problem today" : "No new problem today yet"}
        className="absolute bottom-0 right-0 grid place-items-center rounded-full ring-2 ring-surface"
        style={{ width: dot, height: dot, background: done ? DONE : PENDING }}
      >
        {done ? <Check size={dot - 4} strokeWidth={3.5} className="text-white" /> : <X size={dot - 4} strokeWidth={3.5} className="text-white" />}
      </span>
    </span>
  );
}

function Podium({ top }: { top: Row[] }) {
  const reduce = useReducedMotion();
  // Second, first, third, so the winner stands in the middle.
  const order = useMemo(() => [top[1], top[0], top[2]], [top]);
  const heights = [132, 176, 108];
  return (
    <div className="mx-auto grid max-w-3xl grid-cols-3 items-end gap-3 sm:gap-6">
      {order.map((row, slot) => {
        const place = slot === 1 ? 0 : slot === 0 ? 1 : 2;
        if (!row) return <div key={slot} />;
        return (
          <motion.div
            key={row.student_id}
            className="flex flex-col items-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0 : 0.15 + (2 - place) * 0.12, type: "spring", stiffness: 160, damping: 18 }}
          >
            <Link href={`/student/${row.student_id}/leetcode`} className="flex flex-col items-center transition hover:scale-[1.03]">
              <div className="relative">
                {place === 0 ? (
                  <motion.span
                    className="absolute -top-6 left-1/2 z-10 -translate-x-1/2"
                    animate={reduce ? undefined : { y: [0, -4, 0], rotate: [0, -6, 6, 0] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Crown size={22} fill={MEDAL[0]} color={MEDAL[0]} />
                  </motion.span>
                ) : null}
                <StatusAvatar row={row} size={place === 0 ? 72 : 58} ring={`conic-gradient(${MEDAL[place]}, #ffffff40, ${MEDAL[place]})`} />
              </div>
              <p className={`mt-2 max-w-[150px] truncate text-center text-[13.5px] font-semibold ${row.isMe ? "text-[#ffcf8a]" : ""}`}>
                {row.name}
                {row.isMe ? " (you)" : ""}
              </p>
              <p className="text-[11.5px] text-white/50">Squad {row.squad_number}</p>
            </Link>
            <div
              className="mt-3 flex w-full flex-col items-center justify-start rounded-t-xl border border-b-0 border-white/10 pt-3"
              style={{ height: heights[slot], background: `linear-gradient(180deg, ${MEDAL[place]}33, #ffffff08 70%)` }}
            >
              <span className="font-display text-[26px] font-extrabold leading-none tabular-nums" style={{ color: MEDAL[place] }}>
                <CountUp to={row.points} duration={1.1} />
              </span>
              <span className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/45">points</span>
              <span className="mt-2 font-display text-[34px] font-extrabold leading-none text-white/15">{place + 1}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

const LEVELS = [
  { key: "easy", label: "Easy", color: "#00b8a3" },
  { key: "medium", label: "Medium", color: "#ffc01e" },
  { key: "hard", label: "Hard", color: "#ef4743" },
] as const;

/** LeetCode-style difficulty split: one proportional bar, then each level with its colour. */
function Difficulty({ solved }: { solved: Row["solved"] }) {
  const total = solved.easy + solved.medium + solved.hard;
  return (
    <div className="mt-2.5 max-w-[260px]">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-ink/[0.07]">
        {total
          ? LEVELS.map((level) => (
              <span key={level.key} style={{ width: `${(solved[level.key] / total) * 100}%`, background: level.color }} />
            ))
          : null}
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-[11.5px] tabular-nums text-muted">
        {LEVELS.map((level) => (
          <span key={level.key} className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: level.color }} />
            <span className="font-semibold text-ink-2">{solved[level.key]}</span> {level.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** One student: status, photo and numbers, their profile links, then the activity calendar. */
function RankCard({ row, index, today }: { row: Row; index: number; today: string }) {
  const reduce = useReducedMotion();
  const done = row.solved_today > 0;
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: reduce ? 0 : Math.min(index, 10) * 0.03 }}
      className={`group relative ${row.isMe ? "bg-[#FFA116]/10" : "bg-surface hover:bg-surface-2"} transition-colors`}
    >
      <Link href={`/student/${row.student_id}/leetcode`} aria-label={`Open ${row.name}’s LeetCode profile`} className="absolute inset-0" />
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px]" style={{ background: done ? DONE : PENDING }} />
      <div className="pointer-events-none relative flex h-full flex-col gap-4 p-4 sm:flex-row sm:items-center sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="w-9 shrink-0 text-right font-display text-[18px] font-bold tabular-nums text-faint">#{row.rank}</span>
          <StatusAvatar row={row} size={48} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[15px] font-semibold text-ink">
              {row.name}
              {row.isMe ? <span className="ml-1.5 rounded bg-[#FFA116] px-1.5 py-0.5 text-[10.5px] font-bold text-[#0b0b0e]">YOU</span> : null}
            </p>
            <p className="truncate text-[12px] text-muted">
              Squad {row.squad_number} · @{row.username}
            </p>
            <p className="mt-1.5 font-display text-[19px] font-bold leading-none text-ink">
              {row.points}
              <span className="ml-1 text-[11px] font-medium text-muted">pts</span>
            </p>
            <Difficulty solved={row.solved} />
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11.5px] text-muted">
              <span className="inline-flex items-center gap-1" title="Total problems solved on LeetCode">
                <Zap size={12} className="text-[#FFA116]" /> {row.total_solved ?? "–"} solved
              </span>
              <span className="inline-flex items-center gap-1" title="LeetCode day streak">
                <Flame size={12} className="text-[#e8883a]" /> {row.streak ?? 0}d streak
              </span>
              <span className="inline-flex items-center gap-1" title="Achievements unlocked">
                <Award size={12} className="text-[#d9a400]" /> {row.badges}
              </span>
            </div>
            <ProfileLinks links={row.links} leetcode={row.username} size={28} className="pointer-events-auto relative mt-3" />
          </div>
        </div>
        <div className="shrink-0 self-start sm:self-center">
          <Heatmap days={row.activity_days} today={today} weeks={26} cell={10} gap={2} unit="submissions" />
          <p
            className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${
              done ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : "bg-red-500/10 text-red-700 dark:text-red-300"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: done ? DONE : PENDING }} />
            {done ? `Solved ${row.solved_today} new today` : "Not solved today"}
          </p>
        </div>
      </div>
    </motion.li>
  );
}
