"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Award, Crown, Flame, Info, Zap } from "lucide-react";
import { LightRays } from "@/components/reactbits/light-rays";
import { Embers } from "@/components/fx/embers";
import { LiquidGlass } from "@/components/fx/liquid-glass";
import { RevealText } from "@/components/fx/reveal-text";
import { CountUp } from "@/components/reactbits/count-up";
import { Dropdown } from "@/components/ui/dropdown";
import { Frame, Page } from "@/components/ui/frame";
import { Avatar } from "@/components/leetcode/leetcode-card";
import { Heatmap } from "@/components/leetcode/heatmap";
import { LeetCodeLogo, LEETCODE_ORANGE } from "@/components/leetcode/leetcode-logo";
import { getCurrentUserProfile, type CurrentUserProfile } from "@/lib/auth/profile";
import { useCachedProfile } from "@/lib/auth/use-cached-profile";
import { DAILY_BONUS, POINTS } from "@/lib/gamification";
import { istDay } from "@/lib/leetcode";

type Period = "week" | "month" | "all";
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
  /** LeetCode submissions per IST day, last 18 weeks. */
  activity_days: Record<string, number>;
  total_solved: number | null;
  streak: number | null;
  solved_today: number;
};
type University = { id: string; name: string };

const PERIODS: Array<[Period, string]> = [
  ["week", "This week"],
  ["month", "This month"],
  ["all", "All time"],
];
const MEDAL = ["#F5C451", "#C9D1D9", "#D08A57"];

/** LeetCode points leaderboard: podium for the top three, then everyone else. */
export function LeetCodeLeaderboard() {
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
  const isSuperAdmin = account?.status === "authenticated" && account.profile.role === "super_admin";
  const ready = account?.status === "authenticated";

  const [period, setPeriod] = useState<Period>("week");
  const [universities, setUniversities] = useState<University[]>([]);
  const [universityId, setUniversityId] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [meta, setMeta] = useState({ unlinked: 0, total: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSuperAdmin) return;
    let active = true;
    fetch("/api/super-admin/universities")
      .then((response) => response.json())
      .then((result: { universities?: University[] }) => {
        if (!active) return;
        const list = result.universities ?? [];
        setUniversities(list);
        setUniversityId((current) => current || list[0]?.id || "");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!ready || (isSuperAdmin && !universityId)) return;
    let active = true;
    const query = new URLSearchParams({ period });
    if (isSuperAdmin) query.set("university_id", universityId);
    fetch(`/api/leetcode/leaderboard?${query}`, { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as { rows?: Row[]; unlinked?: number; total?: number; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Couldn’t load the leaderboard.");
        if (!active) return;
        setRows(result.rows ?? []);
        setMeta({ unlinked: result.unlinked ?? 0, total: result.total ?? 0 });
        setError("");
      })
      .catch((loadError) => active && setError(loadError instanceof Error ? loadError.message : "Couldn’t load the leaderboard."));
    return () => {
      active = false;
    };
  }, [ready, isSuperAdmin, universityId, period]);

  const [today] = useState(() => istDay());
  const top = (rows ?? []).slice(0, 3);
  const rest = (rows ?? []).slice(3);
  const me = (rows ?? []).find((row) => row.isMe);

  return (
    <Page className="pb-24">
      <Frame>
        <section className="relative isolate overflow-hidden bg-[#0b0b0e] text-white [&]:rounded-t-[11px]">
          <div aria-hidden="true" className="absolute inset-0">
            <LightRays raysOrigin="top-center" raysColor="#ffcf8a" raysSpeed={0.8} lightSpread={0.85} rayLength={1.5} fadeDistance={1.1} followMouse mouseInfluence={0.06} noiseAmount={0.05} distortion={0.04} />
          </div>
          <Embers density={0.9} />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0b0b0e] to-transparent" />
          <div className="relative px-6 pt-8 text-center sm:px-10 sm:pt-10">
            <p className="inline-flex items-center gap-2 text-[13px] font-medium text-white/60">
              <LeetCodeLogo size={15} /> LeetCode · {PERIODS.find(([value]) => value === period)?.[1]}
            </p>
            <h1 className="mt-2 font-display text-[40px] font-extrabold leading-none tracking-[-0.045em] sm:text-[60px]">
              <RevealText parts={["Problem Solvers"]} />
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-[14px] text-white/60">
              Points for every new problem: Easy {POINTS.Easy}, Medium {POINTS.Medium}, Hard {POINTS.Hard}, plus {DAILY_BONUS} for each daily challenge.
            </p>
            <LiquidGlass className="mt-6 inline-flex rounded-2xl p-1">
            <div className="flex" role="tablist" aria-label="Period">
              {PERIODS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={period === value}
                  onClick={() => {
                    setRows(null);
                    setPeriod(value);
                  }}
                  className="relative rounded-xl px-4 py-2 text-[13px] font-semibold"
                >
                  {period === value ? (
                    <motion.span
                      layoutId="lc-period"
                      className="absolute inset-0 rounded-xl bg-white shadow-[0_4px_18px_rgba(255,161,22,0.35)]"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  ) : null}
                  <span className={`relative ${period === value ? "text-[#0b0b0e]" : "text-white/75"}`}>{label}</span>
                </button>
              ))}
            </div>
            </LiquidGlass>
            {isSuperAdmin ? (
              <div className="mt-3 flex justify-center">
                <Dropdown
                  chevron
                  aria-label="University"
                  value={universityId}
                  onChange={(value) => {
                    setRows(null);
                    setUniversityId(value);
                  }}
                  className="h-8 min-w-[150px] rounded-lg border border-white/15 bg-white/10 px-3 text-[12.5px] text-white"
                >
                  {universities.map((university) => (
                    <option key={university.id} value={university.id}>
                      {university.name}
                    </option>
                  ))}
                </Dropdown>
              </div>
            ) : null}
          </div>
          <div className="relative px-3 pb-0 pt-6 sm:px-10">
            {rows === null ? (
              <div className="flex h-64 items-center justify-center text-[13px] text-white/50">{error || "Counting points…"}</div>
            ) : rows.length === 0 ? (
              <div className="flex h-56 items-center justify-center px-6 pb-10 text-center text-[14px] text-white/60">
                No one has linked LeetCode yet. Link yours under Practice → LeetCode to claim the first spot.
              </div>
            ) : (
              <Podium top={top} />
            )}
          </div>
        </section>

        {rows && rows.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[12.5px] text-muted sm:px-5">
              <span>
                {rows.length} ranked{meta.unlinked ? ` · ${meta.unlinked} haven’t linked LeetCode yet` : ""}
              </span>
              <span className="inline-flex items-center gap-1">
                <Info size={13} /> {period === "all" ? "All time uses LeetCode’s lifetime solved counts." : "Counts new problems tracked since each student linked LeetCode."}
              </span>
            </div>
            {rest.length ? (
              <ol className="grid gap-px border-t border-line bg-line lg:grid-cols-2">
                {rest.map((row, index) => (
                  <RankCard key={row.student_id} row={row} index={index} today={today} />
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
                  className="absolute -top-6 left-1/2 -translate-x-1/2"
                  animate={reduce ? undefined : { y: [0, -4, 0], rotate: [0, -6, 6, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Crown size={22} fill={MEDAL[0]} color={MEDAL[0]} />
                </motion.span>
              ) : null}
              <div className="rounded-full p-[3px]" style={{ background: `conic-gradient(${MEDAL[place]}, #ffffff40, ${MEDAL[place]})` }}>
                <Avatar name={row.name} src={row.avatar_url} size={place === 0 ? 72 : 58} />
              </div>
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

/** One student: rank and photo, their numbers, then the green-dot activity calendar. */
function RankCard({ row, index, today }: { row: Row; index: number; today: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: reduce ? 0 : Math.min(index, 10) * 0.03 }}
    >
      <Link
        href={`/student/${row.student_id}/leetcode`}
        className={`flex h-full flex-col gap-4 p-4 transition-colors sm:flex-row sm:items-center sm:px-5 ${row.isMe ? "bg-[#FFA116]/10" : "bg-surface hover:bg-surface-2"}`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="w-9 shrink-0 text-right font-display text-[18px] font-bold tabular-nums text-faint">#{row.rank}</span>
          <Avatar name={row.name} src={row.avatar_url} size={48} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[15px] font-semibold text-ink">
              {row.name}
              {row.isMe ? <span className="ml-1.5 rounded bg-[#FFA116] px-1.5 py-0.5 text-[10.5px] font-bold text-[#0b0b0e]">YOU</span> : null}
            </p>
            <p className="truncate text-[12px] text-muted">
              Squad {row.squad_number} · @{row.username}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px] font-semibold tabular-nums">
              <span className="font-display text-[17px] font-bold text-ink">
                {row.points}
                <span className="ml-0.5 text-[11px] font-medium text-muted">pts</span>
              </span>
              <span className="rounded-md bg-emerald-500/12 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">E {row.solved.easy}</span>
              <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-amber-700 dark:text-amber-300">M {row.solved.medium}</span>
              <span className="rounded-md bg-red-500/12 px-1.5 py-0.5 text-red-700 dark:text-red-300">H {row.solved.hard}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11.5px] text-muted">
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
          </div>
        </div>
        <div className="shrink-0 self-start sm:self-center">
          <Heatmap days={row.activity_days} today={today} weeks={18} cell={9} gap={2} unit="submissions" />
          <p className={`mt-1 text-[11px] ${row.solved_today > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-faint"}`}>
            {row.solved_today > 0 ? `Solved ${row.solved_today} new today` : "No new solve yet today"}
          </p>
        </div>
      </Link>
    </motion.li>
  );
}
