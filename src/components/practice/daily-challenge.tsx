"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, CalendarCheck, Check, ExternalLink, Flame, Link2, RefreshCw, Trophy } from "lucide-react";
import { ConfettiBurst } from "@/components/leaderboard/confetti-burst";
import { SpotlightCard } from "@/components/fx/spotlight-card";
import { LeetCodeLogo } from "@/components/leetcode/leetcode-logo";
import type { Difficulty } from "@/lib/dojo-syllabus";

type Daily = {
  today: string;
  challenge: null | {
    day: string;
    title_slug: string;
    title: string;
    difficulty: Difficulty;
    topic: string | null;
    completed_at: string | null;
  };
  streak: number;
  best: number;
  history: Array<{ day: string; status: "done" | "missed" | "open" | "none" }>;
  linked: boolean;
};

const DIFFICULTY: Record<Difficulty, string> = {
  Easy: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  Medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  Hard: "bg-red-500/12 text-red-700 dark:text-red-300",
};
const DOT: Record<Daily["history"][number]["status"], string> = {
  done: "bg-emerald-500",
  missed: "bg-red-500/70",
  open: "bg-transparent ring-2 ring-amber-500",
  none: "bg-sunken",
};

/**
 * Today's one problem. It completes itself once LeetCode shows it accepted
 * today; there's deliberately no way to tick it by hand.
 */
export function DailyChallenge({ showPracticeLink = false }: { showPracticeLink?: boolean }) {
  const [daily, setDaily] = useState<Daily | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const load = useCallback(
    () =>
      fetch("/api/daily", { cache: "no-store" })
        .then(async (response) => {
          const result = (await response.json()) as Daily & { error?: string };
          if (!response.ok) throw new Error(result.error ?? "Couldn’t load today’s challenge.");
          setDaily(result);
          setError("");
        })
        .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Couldn’t load today’s challenge.")),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  function check() {
    setChecking(true);
    void load().finally(() => setChecking(false));
  }

  if (error && !daily) return <div className="rounded-xl border border-line bg-surface px-5 py-4 text-[13px] text-muted">{error}</div>;
  if (!daily)
    return <div className="h-[168px] animate-pulse rounded-xl border border-line bg-surface" aria-label="Loading today’s challenge" />;

  const challenge = daily.challenge;
  const done = Boolean(challenge?.completed_at);
  return (
    <SpotlightCard tilt={2} glow={done ? "61,187,111" : "255,161,22"} className="rounded-xl">
    <section
      className={`relative overflow-hidden rounded-xl border p-5 shadow-[var(--card-shadow)] transition-colors sm:p-6 ${
        done ? "border-emerald-500/40 bg-emerald-500/[0.07]" : "border-line-strong bg-surface"
      }`}
    >
      {done ? <ConfettiBurst delay={200} count={60} /> : null}
      <div aria-hidden="true" className={`absolute -right-16 -top-16 size-56 rounded-full blur-3xl ${done ? "bg-emerald-500/20" : "bg-action/15"}`} />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-brand-text">
            <CalendarCheck size={13} /> Daily challenge{challenge?.topic ? ` · ${challenge.topic}` : ""}
          </p>
          {challenge ? (
            <>
              <h2 className="mt-1 font-display text-[24px] font-bold tracking-[-0.02em] sm:text-[28px]">{challenge.title}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px]">
                <span className={`rounded-md px-2 py-0.5 font-semibold ${DIFFICULTY[challenge.difficulty]}`}>{challenge.difficulty}</span>
                {done ? (
                  <motion.span
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-0.5 font-semibold text-white"
                  >
                    <Check size={13} strokeWidth={3} /> Solved{" "}
                    {new Date(challenge.completed_at!).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                  </motion.span>
                ) : (
                  <span className="text-muted">Get it Accepted on LeetCode today. It ticks itself within a few minutes.</span>
                )}
              </div>
            </>
          ) : (
            <p className="mt-2 text-[14px] text-muted">You’ve solved every suggested problem for your belts. Pick anything new on LeetCode to keep your card green.</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="text-center">
            <p className="inline-flex items-center gap-1 font-display text-[30px] font-extrabold leading-none tabular-nums">
              <Flame size={24} className={daily.streak ? "text-[#e8883a]" : "text-faint"} />
              {daily.streak}
            </p>
            <p className="mt-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">day streak</p>
          </div>
          <div className="text-center">
            <p className="inline-flex items-center gap-1 font-display text-[18px] font-bold leading-none tabular-nums text-ink-2">
              <Trophy size={15} className="text-[#d9a400]" />
              {daily.best}
            </p>
            <p className="mt-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">best</p>
          </div>
        </div>
      </div>

      <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5" aria-label="Last 14 days">
          {daily.history.map((item) => (
            <span
              key={item.day}
              title={`${new Date(`${item.day}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}: ${
                item.status === "done" ? "solved" : item.status === "missed" ? "missed" : item.status === "open" ? "today" : "no challenge"
              }`}
              className={`size-3 rounded-[3px] ${DOT[item.status]}`}
            />
          ))}
          <span className="ml-1 text-[11px] text-faint">last 14 days</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {showPracticeLink ? (
            <Link href="/student/practice" className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold text-ink-2 hover:text-ink">
              All suggestions <ArrowRight size={14} />
            </Link>
          ) : null}
          {challenge && !done ? (
            <button
              type="button"
              onClick={check}
              disabled={checking}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-[13px] font-medium text-ink-2 hover:text-ink disabled:opacity-60"
            >
              <RefreshCw size={14} className={checking ? "animate-spin" : ""} /> {checking ? "Checking…" : "Check now"}
            </button>
          ) : null}
          {challenge ? (
            <a
              href={`https://leetcode.com/problems/${challenge.title_slug}/`}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold text-white transition ${
                done ? "bg-emerald-600 hover:bg-emerald-700" : "bg-action hover:bg-action-hover"
              }`}
            >
              <LeetCodeLogo size={14} color="currentColor" />
              {done ? "Open again" : "Solve on LeetCode"} <ExternalLink size={13} />
            </a>
          ) : null}
        </div>
      </div>

      {!daily.linked ? (
        <p className="relative mt-3 flex flex-wrap items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-[12.5px] text-ink-2">
          <Link2 size={13} className="text-amber-600 dark:text-amber-400" />
          Link your LeetCode account so we can see when you solve it.
          <Link href="/student/leetcode" className="font-semibold text-ink hover:underline">
            Link now
          </Link>
        </p>
      ) : null}
    </section>
    </SpotlightCard>
  );
}
