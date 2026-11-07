"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Calendar, Crown, Flame, Lock, Moon, Mountain, Shield, Sparkles, Sunrise, Target, X, Zap } from "lucide-react";
import type { Achievement, Tier } from "@/lib/gamification";
import { SpotlightCard } from "@/components/fx/spotlight-card";

const ICONS = {
  spark: Sparkles,
  flame: Flame,
  mountain: Mountain,
  crown: Crown,
  sunrise: Sunrise,
  moon: Moon,
  calendar: Calendar,
  target: Target,
  bolt: Zap,
  shield: Shield,
} as const;

export const TIER: Record<Tier, { label: string; ring: string; glow: string; text: string }> = {
  bronze: { label: "Bronze", ring: "linear-gradient(135deg,#e8a36b,#9a5a2c)", glow: "#d0895760", text: "#b8723f" },
  silver: { label: "Silver", ring: "linear-gradient(135deg,#f1f4f7,#8d98a5)", glow: "#c9d1d960", text: "#8a96a3" },
  gold: { label: "Gold", ring: "linear-gradient(135deg,#ffe08a,#c8901a)", glow: "#f5c45170", text: "#c99a1c" },
  legend: { label: "Legend", ring: "conic-gradient(from 0deg,#ffa116,#ef3837,#a36bd4,#4aa3e0,#ffa116)", glow: "#ffa11670", text: "#e8883a" },
};

export function useAchievements() {
  const [list, setList] = useState<Achievement[] | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/leetcode/achievements", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<{ achievements: Achievement[] }>) : Promise.reject()))
      .then((result) => active && setList(result.achievements))
      .catch(() => active && setList([]));
    return () => {
      active = false;
    };
  }, []);
  return list;
}

/** A medal: tier-coloured ring, icon in the middle, greyed out while locked. */
export function Medal({ achievement, size = 56 }: { achievement: Achievement; size?: number }) {
  const Icon = ICONS[achievement.icon];
  const tier = TIER[achievement.tier];
  return (
    <span
      className="relative grid shrink-0 place-items-center rounded-full p-[3px]"
      style={{
        width: size,
        height: size,
        background: achievement.unlocked ? tier.ring : "var(--line-strong)",
        boxShadow: achievement.unlocked ? `0 6px 22px ${tier.glow}` : undefined,
      }}
    >
      <span className="grid size-full place-items-center rounded-full bg-surface">
        {achievement.unlocked ? (
          <Icon size={size * 0.42} style={{ color: tier.text }} strokeWidth={2.2} />
        ) : (
          <Lock size={size * 0.34} className="text-faint" />
        )}
      </span>
    </span>
  );
}

/** All achievements: unlocked first, then the closest to unlocking. */
export function AchievementGrid({ list }: { list: Achievement[] }) {
  const unlocked = list.filter((item) => item.unlocked).length;
  const sorted = [...list].sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || b.progress / b.goal - a.progress / a.goal);
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2 px-5 py-4">
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-brand-text">Achievements</p>
          <h2 className="font-display text-[20px] font-bold tracking-[-0.02em]">
            {unlocked} of {list.length} unlocked
          </h2>
        </div>
        <div className="h-2 w-48 overflow-hidden rounded-full bg-sunken">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg,#ffa116,#ef3837)" }}
            initial={{ width: 0 }}
            animate={{ width: `${(unlocked / Math.max(1, list.length)) * 100}%` }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>
      <ul className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((item, index) => (
          <motion.li
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: Math.min(index, 9) * 0.03 }}
            className="bg-surface"
          >
            <SpotlightCard tilt={4} glow={item.unlocked ? "255,161,22" : "160,160,170"} className="h-full">
            <div className="flex h-full items-center gap-3.5 px-5 py-4">
            <motion.span whileHover={item.unlocked ? { rotate: [0, -10, 10, 0], scale: 1.08 } : undefined} transition={{ duration: 0.5 }}>
              <Medal achievement={item} />
            </motion.span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                {item.name}
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: TIER[item.tier].text }}>
                  {TIER[item.tier].label}
                </span>
              </p>
              <p className="text-[12.5px] leading-snug text-muted">{item.description}</p>
              {!item.unlocked ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
                    <div className="h-full rounded-full bg-ink-2/60" style={{ width: `${(item.progress / item.goal) * 100}%` }} />
                  </div>
                  <span className="text-[11px] tabular-nums text-faint">
                    {item.progress}/{item.goal}
                  </span>
                </div>
              ) : null}
            </div>
            </div>
            </SpotlightCard>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

const SEEN_KEY = "dojo-achievements-seen";
function readSeen(): string[] | null {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

/**
 * "Achievement unlocked" pop-ups for anything unlocked since this device last
 * looked. The very first visit sums them up in one card instead of a flood.
 */
export function AchievementToasts({ list }: { list: Achievement[] | null }) {
  const [queue, setQueue] = useState<Array<{ key: string; title: string; achievement: Achievement | null; extra?: string }>>([]);

  useEffect(() => {
    if (!list) return;
    const unlocked = list.filter((item) => item.unlocked);
    const seen = readSeen();
    const fresh = seen ? unlocked.filter((item) => !seen.includes(item.id)) : [];
    try {
      window.localStorage.setItem(SEEN_KEY, JSON.stringify(unlocked.map((item) => item.id)));
    } catch {
      // Storage blocked: pop-ups just show again next time.
    }
    const items =
      seen === null
        ? unlocked.length
          ? [{ key: "welcome", title: `${unlocked.length} achievement${unlocked.length === 1 ? "" : "s"} already unlocked`, achievement: unlocked.at(-1)!, extra: "Keep solving to collect the rest." }]
          : []
        : fresh.map((item) => ({ key: item.id, title: "Achievement unlocked", achievement: item }));
    if (!items.length) return;
    const timer = window.setTimeout(() => setQueue(items), 600);
    return () => window.clearTimeout(timer);
  }, [list]);

  useEffect(() => {
    if (!queue.length) return;
    const timer = window.setTimeout(() => setQueue((current) => current.slice(1)), 5200);
    return () => window.clearTimeout(timer);
  }, [queue]);

  const current = queue[0];
  return (
    <div className="pointer-events-none fixed right-4 top-20 z-50 flex w-[320px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      <AnimatePresence>
        {current ? (
          <motion.div
            key={current.key}
            initial={{ opacity: 0, x: 60, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="pointer-events-auto relative flex items-center gap-3 overflow-hidden rounded-xl border border-line-strong bg-surface p-3.5 shadow-[var(--pop-shadow)]"
          >
            <motion.span
              aria-hidden="true"
              className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent"
              animate={{ x: ["0%", "400%"] }}
              transition={{ duration: 1.2, delay: 0.3 }}
            />
            {current.achievement ? (
              <motion.span initial={{ rotate: -30, scale: 0.4 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 220, damping: 12 }}>
                <Medal achievement={current.achievement} size={48} />
              </motion.span>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-text">{current.title}</p>
              {current.extra ? (
                <p className="text-[13px] text-ink-2">{current.extra}</p>
              ) : (
                <>
                  <p className="truncate font-display text-[15px] font-bold text-ink">{current.achievement?.name}</p>
                  <p className="truncate text-[12px] text-muted">{current.achievement?.description}</p>
                </>
              )}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setQueue((list) => list.slice(1))}
              className="self-start rounded p-0.5 text-faint hover:text-ink"
            >
              <X size={14} />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
