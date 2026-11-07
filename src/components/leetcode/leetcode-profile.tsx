"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Award, CalendarCheck, ExternalLink, Flame } from "lucide-react";
import { AuroraShader } from "@/components/fx/aurora-shader";
import { CodeRain } from "@/components/fx/code-rain";
import { RevealText } from "@/components/fx/reveal-text";
import { SpotlightCard } from "@/components/fx/spotlight-card";
import { CountUp } from "@/components/reactbits/count-up";
import { PanelSkeleton } from "@/components/ui/skeleton";
import { Heatmap } from "@/components/leetcode/heatmap";
import { Avatar } from "@/components/leetcode/leetcode-card";
import { LeetCodeLogo, LEETCODE_ORANGE } from "@/components/leetcode/leetcode-logo";
import { AchievementGrid } from "@/components/leetcode/achievements";
import { istDay, type LeetCodeCard } from "@/lib/leetcode";
import type { Achievement } from "@/lib/gamification";

type Standing = { rank: number | null; of: number; points: number };
type Profile = {
  student: { id: string; name: string; squad_number: string; university_name: string | null };
  card: LeetCodeCard | null;
  linked: boolean;
  isSelf: boolean;
  standing?: { week: Standing; month: Standing; all: Standing };
  achievements?: Achievement[];
  recent?: Array<{ title_slug: string; title: string | null; solved_at: string; difficulty: string | null }>;
  daily?: { done: number; history: Array<{ day: string; status: "done" | "missed" | "open" | "none" }> };
  topics?: Array<{ tag: string; count: number }>;
};

const COLORS = { Easy: "#2cbb5d", Medium: "#ffb800", Hard: "#ef4743" } as const;
const pretty = (tag: string) => tag.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

/** A student's LeetCode profile, in full: standing, stats, calendar, topics, solves and badges. */
export function LeetCodeProfile({ studentId }: { studentId: string }) {
  const [data, setData] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [today] = useState(() => istDay());
  const [view, setView] = useState<"activity" | "solved">("activity");

  useEffect(() => {
    let active = true;
    fetch(`/api/leetcode/profile/${studentId}`, { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as Profile & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Couldn’t load this LeetCode profile.");
        if (active) setData(result);
      })
      .catch((loadError) => active && setError(loadError instanceof Error ? loadError.message : "Couldn’t load this LeetCode profile."));
    return () => {
      active = false;
    };
  }, [studentId]);

  if (error) return <p className="px-6 py-12 text-center text-[14px] text-muted">{error}</p>;
  if (!data) return <PanelSkeleton rows={6} label="Loading LeetCode profile" flat />;

  if (!data.linked || !data.card?.username)
    return (
      <div className="px-6 py-14 text-center">
        <LeetCodeLogo size={36} className="mx-auto" />
        <p className="mt-3 font-display text-[18px] font-bold">{data.isSelf ? "Link your LeetCode" : `${data.student.name} hasn’t linked LeetCode yet`}</p>
        <p className="mt-1 text-[13.5px] text-muted">Once linked, solves, streaks and badges show up here.</p>
        {data.isSelf ? (
          <Link href="/student/leetcode" className="mt-4 inline-flex h-9 items-center rounded-lg bg-action px-4 text-[13px] font-semibold text-white">
            Link LeetCode
          </Link>
        ) : null}
      </div>
    );

  const card = data.card;
  const standing = data.standing!;
  const unlocked = (data.achievements ?? []).filter((item) => item.unlocked).length;
  const days = view === "solved" ? card.solved_days : card.activity_days;
  const yearTotal = Object.values(days).reduce((sum, value) => sum + value, 0);

  return (
    <div className="flex flex-col">
      {/* Stage */}
      <section className="relative isolate overflow-hidden bg-[#07070a] text-white">
        <AuroraShader base="#060609" mid="#2a1a06" glow={LEETCODE_ORANGE} intensity={0.95} />
        <CodeRain accent="255,161,22" density={0.6} />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#07070a] via-[#07070a]/75 to-transparent" />
        <div className="relative flex flex-wrap items-center justify-between gap-6 px-6 py-8 sm:px-10">
          <div className="flex min-w-0 items-center gap-5">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 16 }}
              className="rounded-full p-[3px]"
              style={{ background: `conic-gradient(${LEETCODE_ORANGE}, #ef3837, ${LEETCODE_ORANGE})` }}
            >
              <Avatar name={data.student.name} src={card.avatar_url} size={84} />
            </motion.div>
            <div className="min-w-0">
              <h2 className="font-display text-[30px] font-extrabold leading-tight tracking-[-0.04em] sm:text-[38px]">
                <RevealText parts={[data.student.name]} />
              </h2>
              <a
                href={`https://leetcode.com/u/${card.username}/`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 text-[14px] font-semibold text-white/85 hover:text-white"
              >
                <LeetCodeLogo size={16} /> {card.username} <ExternalLink size={12} className="text-white/50" />
              </a>
              <p className="mt-0.5 text-[12.5px] text-white/50">
                {data.student.university_name ? `${data.student.university_name} · ` : ""}Squad {data.student.squad_number}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["This week", standing.week],
                ["This month", standing.month],
                ["All time", standing.all],
              ] as const
            ).map(([label, item], index) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.08 }}
                className="min-w-[110px] rounded-xl border border-white/12 bg-white/[0.06] px-3.5 py-2.5 backdrop-blur"
              >
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white/45">{label}</p>
                <p className="mt-0.5 font-display text-[22px] font-extrabold leading-none tabular-nums">
                  {item.rank ? <>#{item.rank}</> : "—"}
                  <span className="ml-1 text-[11px] font-medium text-white/40">/ {item.of}</span>
                </p>
                <p className="mt-1 text-[11.5px] tabular-nums" style={{ color: LEETCODE_ORANGE }}>
                  {item.points} pts
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Numbers */}
      <div className="grid gap-px border-y border-line bg-line sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="flex items-center gap-5 bg-surface px-5 py-5">
          <DifficultyRing easy={card.easy_solved ?? 0} medium={card.medium_solved ?? 0} hard={card.hard_solved ?? 0} total={card.total_solved ?? 0} />
          <dl className="flex flex-col gap-1.5 text-[12.5px]">
            {(
              [
                ["Easy", card.easy_solved],
                ["Medium", card.medium_solved],
                ["Hard", card.hard_solved],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: COLORS[label] }} />
                <dt className="w-14 text-muted">{label}</dt>
                <dd className="font-semibold tabular-nums text-ink">{value ?? 0}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Tile icon={<Flame size={16} className="text-[#e8883a]" />} label="LeetCode streak" value={card.leetcode_streak ?? 0} hint="days in a row" />
        <Tile icon={<CalendarCheck size={16} className="text-brand" />} label="Daily challenges" value={data.daily?.done ?? 0} hint={`${card.solved_today} new today`} />
        <Tile icon={<Award size={16} className="text-[#d9a400]" />} label="Achievements" value={unlocked} hint={`of ${data.achievements?.length ?? 0}`} />
      </div>

      {/* Calendar */}
      <div className="border-b border-line">
        <div className="flex flex-wrap items-end justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-brand-text">The year</p>
            <h3 className="font-display text-[18px] font-bold tracking-[-0.02em]">
              {yearTotal} {view === "solved" ? "new problems" : "submissions"} in the last year
            </h3>
          </div>
          <div className="flex rounded-lg bg-sunken p-0.5" role="group" aria-label="Calendar">
            {(
              [
                ["activity", "LeetCode activity"],
                ["solved", "New problems"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className="relative rounded-md px-2.5 py-1 text-[12.5px] font-medium"
              >
                {view === value ? <motion.span layoutId="lc-profile-view" className="absolute inset-0 rounded-md bg-surface shadow-[var(--card-shadow)] ring-[0.5px] ring-line" /> : null}
                <span className={`relative ${view === value ? "text-ink" : "text-muted"}`}>{label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto px-5 pb-5">
          <Heatmap days={days} today={today} weeks={53} cell={12} gap={3} showMonths unit={view === "solved" ? "problems" : "submissions"} />
        </div>
      </div>

      {/* Topics and recent solves */}
      <div className="grid gap-px border-b border-line bg-line lg:grid-cols-2">
        <div className="bg-surface px-5 py-4">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-brand-text">Strongest topics</p>
          <h3 className="font-display text-[18px] font-bold tracking-[-0.02em]">Problems solved by topic</h3>
          <TopicBars topics={data.topics ?? []} />
        </div>
        <div className="bg-surface px-5 py-4">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-brand-text">Recently solved</p>
          <h3 className="font-display text-[18px] font-bold tracking-[-0.02em]">New problems</h3>
          {data.recent?.length ? (
            <ul className="mt-2 divide-y divide-line">
              {data.recent.map((item, index) => (
                <motion.li key={item.title_slug} initial={{ opacity: 0, x: 8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: Math.min(index, 8) * 0.03 }}>
                  <a href={`https://leetcode.com/problems/${item.title_slug}/`} target="_blank" rel="noreferrer" className="group flex items-center gap-2.5 py-2">
                    <LeetCodeLogo size={14} />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink group-hover:underline">{item.title ?? item.title_slug}</span>
                    {item.difficulty ? (
                      <span className="text-[11px] font-semibold" style={{ color: COLORS[item.difficulty as keyof typeof COLORS] }}>
                        {item.difficulty}
                      </span>
                    ) : null}
                    <span className="w-24 text-right text-[11.5px] tabular-nums text-faint">
                      {new Date(item.solved_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}
                    </span>
                  </a>
                </motion.li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-muted">No new problems tracked yet.</p>
          )}
        </div>
      </div>

      {/* Daily challenge */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-brand-text">Daily challenge</p>
          <h3 className="font-display text-[18px] font-bold tracking-[-0.02em]">Last 30 days</h3>
        </div>
        <div className="flex flex-wrap gap-1">
          {(data.daily?.history ?? []).map((item) => (
            <span
              key={item.day}
              title={`${item.day}: ${item.status === "done" ? "solved" : item.status === "missed" ? "missed" : item.status === "open" ? "today" : "no challenge"}`}
              className={`size-3.5 rounded-[3px] ${
                item.status === "done" ? "bg-emerald-500" : item.status === "missed" ? "bg-red-500/70" : item.status === "open" ? "ring-2 ring-amber-500" : "bg-sunken"
              }`}
            />
          ))}
        </div>
      </div>

      {data.achievements?.length ? <AchievementGrid list={data.achievements} /> : null}
    </div>
  );
}

function Tile({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number; hint: string }) {
  return (
    <SpotlightCard tilt={0} glow="255,161,22" className="bg-surface">
      <div className="px-5 py-5">
        <p className="flex items-center gap-1.5 text-[12.5px] text-muted">
          {icon} {label}
        </p>
        <p className="mt-1 font-display text-[30px] font-extrabold leading-none tabular-nums text-ink">
          <CountUp to={value} duration={1} />
        </p>
        <p className="mt-1 text-[11.5px] text-faint">{hint}</p>
      </div>
    </SpotlightCard>
  );
}

/** Solved count with Easy / Medium / Hard as arcs of one ring. */
function DifficultyRing({ easy, medium, hard, total }: { easy: number; medium: number; hard: number; total: number }) {
  const reduce = useReducedMotion();
  const radius = 42;
  const length = 2 * Math.PI * radius;
  const sum = Math.max(1, easy + medium + hard);
  const parts = [
    [easy, COLORS.Easy],
    [medium, COLORS.Medium],
    [hard, COLORS.Hard],
  ] as const;
  let offset = 0;
  return (
    <div className="relative grid size-[104px] shrink-0 place-items-center">
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--sunken)" strokeWidth="8" />
        {parts.map(([value, color], index) => {
          const size = (value / sum) * length;
          const start = offset;
          offset += size;
          return (
            <motion.circle
              key={color}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeDasharray={`${Math.max(0, size - 2)} ${length}`}
              initial={{ strokeDashoffset: length }}
              animate={{ strokeDashoffset: -start }}
              transition={{ duration: reduce ? 0 : 1.1, delay: 0.15 * index, ease: [0.16, 1, 0.3, 1] }}
            />
          );
        })}
      </svg>
      <div className="text-center">
        <p className="font-display text-[26px] font-extrabold leading-none tabular-nums">
          <CountUp to={total} duration={1.1} />
        </p>
        <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">solved</p>
      </div>
    </div>
  );
}

function TopicBars({ topics }: { topics: Array<{ tag: string; count: number }> }) {
  if (!topics.length) return <p className="mt-3 text-[13px] text-muted">LeetCode didn’t return topic stats.</p>;
  const max = Math.max(...topics.map((topic) => topic.count));
  return (
    <ul className="mt-3 flex flex-col gap-1.5">
      {topics.map((topic, index) => (
        <li key={topic.tag} className="flex items-center gap-3 text-[12.5px]">
          <span className="w-36 shrink-0 truncate text-ink-2">{pretty(topic.tag)}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${LEETCODE_ORANGE}, #ef3837)` }}
              initial={{ width: 0 }}
              whileInView={{ width: `${(topic.count / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: Math.min(index, 10) * 0.04, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <span className="w-8 text-right font-semibold tabular-nums text-ink">{topic.count}</span>
        </li>
      ))}
    </ul>
  );
}

