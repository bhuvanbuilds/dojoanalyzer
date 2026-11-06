"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  BookOpen,
  Check,
  ExternalLink,
  Flag,
  Flame,
  Lightbulb,
  Lock,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { Grainient } from "@/components/reactbits/grainient";
import { CountUp } from "@/components/reactbits/count-up";
import { ClickSpark } from "@/components/reactbits/click-spark";
import { ConfettiBurst } from "@/components/leaderboard/confetti-burst";
import { BeltStrip, BeltTag, LanguageLogo } from "@/components/belts/belts";
import { Frame, Page } from "@/components/ui/frame";
import { PageState } from "@/components/ui/skeleton";
import { BELT_SLOTS, beltFill, beltOf } from "@/lib/belts";
import {
  TARGET_LANGUAGES,
  TARGET_LANGUAGE_LABELS,
  daysLeft,
  describeTarget,
  monthKey,
  monthLabel,
  type BeltTarget,
  type Levels,
  type TargetLanguage,
  type TargetProgress,
} from "@/lib/belt-targets";
import { DAILY_QUESTS, LANGUAGE_RESOURCES, LANGUAGE_TIPS } from "@/lib/learning-hub";

type Mine = {
  target: BeltTarget | null;
  progress?: TargetProgress;
  month?: string;
  now?: Levels;
  start?: Levels;
};

const EMPTY: Levels = { cpp: 0, java: 0, nodejs: 0, python: 0 };

/** A student's monthly target as a game: quest map, belts, daily quests, training. */
export function QuestPage() {
  const [mine, setMine] = useState<Mine | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/targets/mine", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<Mine>) : Promise.reject()))
      .then((result) => active && setMine(result))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  if (failed) return <PageState message="Couldn’t load your quest" detail="Refresh the page to try again." />;
  if (!mine) return <PageState message="Loading your quest…" loading />;

  const month = mine.month ?? monthKey();
  const now = mine.now ?? EMPTY;
  const start = mine.start ?? now;
  const focus = mine.progress?.languages.map((item) => item.language) ?? [];

  return (
    <Page className="pb-16">
      <div className="flex flex-col gap-4">
        <Hero mine={mine} month={month} />
        {mine.target && mine.progress ? <QuestMap target={mine.target} progress={mine.progress} start={start} now={now} /> : null}
        <div className="grid items-start gap-4 xl:grid-cols-[1.35fr_1fr]">
          <BeltLadder now={now} start={start} progress={mine.progress} />
          <DailyQuests />
        </div>
        <TrainingGround focus={focus} />
      </div>
    </Page>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ mine, month }: { mine: Mine; month: string }) {
  const progress = mine.progress;
  const done = Boolean(progress?.done);
  const left = daysLeft(month);
  return (
    <section className="relative isolate overflow-hidden rounded-xl border border-line bg-[#0b0b0e] text-white shadow-[var(--card-shadow)]">
      <div aria-hidden="true" className="absolute inset-0 opacity-90">
        <Grainient
          color1="#09090b"
          color2={done ? "#123d24" : "#40181a"}
          color3={done ? "#3dbb6f" : "#ef3837"}
          timeSpeed={0.14}
          warpStrength={0.9}
          warpAmplitude={45}
          grainAmount={0.08}
          contrast={1.2}
          saturation={0.95}
          zoom={1.05}
          centerX={0.7}
        />
      </div>
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#0b0b0e] via-[#0b0b0e]/70 to-transparent" />
      {done ? <ConfettiBurst delay={500} /> : null}

      <div className="relative grid items-center gap-8 px-6 py-8 sm:px-10 sm:py-10 md:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[12px] font-medium text-white/70 backdrop-blur"
          >
            <Swords size={13} /> Season · {monthLabel(month)}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mt-3 font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-[48px]"
          >
            {done ? "Quest complete." : mine.target ? "Your belt quest" : "Your training hall"}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-2 max-w-xl text-[15px] leading-relaxed text-white/65"
          >
            {mine.target
              ? done
                ? `You hit your target (${describeTarget(mine.target)}). Anything more this month is bonus.`
                : `This month's mission: ${describeTarget(mine.target)}. Every weekly belt test moves you along the map.`
              : "No target this month yet. Your mentor sets one; until then, train here and climb the belts anyway."}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-5 flex flex-wrap items-center gap-2 text-[12.5px]"
          >
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 font-medium">
              <Flame size={14} className="text-[#ffb36b]" /> {left} day{left === 1 ? "" : "s"} left
            </span>
            {mine.target?.set_by_name ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-white/75">
                <Target size={14} /> Set by {mine.target.set_by_name}
              </span>
            ) : null}
          </motion.div>

          {mine.target?.note ? (
            <motion.blockquote
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 }}
              className="relative mt-5 max-w-lg rounded-xl rounded-tl-sm border border-white/10 bg-white/[0.07] px-4 py-3 text-[14px] italic text-white/85 backdrop-blur"
            >
              “{mine.target.note}”
              <span className="mt-1 block text-[11.5px] not-italic text-white/45">— {mine.target.set_by_name ?? "Your mentor"}</span>
            </motion.blockquote>
          ) : null}
        </div>

        {progress ? <ProgressRing gained={progress.gained} goal={progress.goal} done={done} /> : <IdleEmblem />}
      </div>
    </section>
  );
}

function ProgressRing({ gained, goal, done }: { gained: number; goal: number; done: boolean }) {
  const reduce = useReducedMotion();
  const fraction = goal ? Math.min(1, gained / goal) : 0;
  const size = 196;
  const radius = 80;
  return (
    <div className="relative mx-auto grid place-items-center" style={{ width: size, height: size }}>
      {!reduce ? (
        <motion.div
          aria-hidden="true"
          className="absolute inset-3 rounded-full"
          style={{ background: done ? "rgba(61,187,111,0.25)" : "rgba(239,56,55,0.22)", filter: "blur(28px)" }}
          animate={{ scale: [0.92, 1.05, 0.92] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={12} />
        {fraction > 0 ? (
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={done ? "#3dbb6f" : "url(#quest-ring)"}
          strokeWidth={12}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: fraction }}
          transition={{ duration: reduce ? 0 : 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        />
        ) : null}
        <defs>
          <linearGradient id="quest-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffb36b" />
            <stop offset="100%" stopColor="#ef3837" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-[44px] font-extrabold leading-none tracking-[-0.04em] tabular-nums">
            <CountUp to={gained} duration={1.2} delay={0.2} />
            <span className="text-[22px] font-semibold text-white/40">/{goal}</span>
          </p>
          <p className="mt-1 text-[12px] font-medium uppercase tracking-[0.12em] text-white/55">
            {done ? "Complete" : "belts gained"}
          </p>
        </div>
      </div>
    </div>
  );
}

function IdleEmblem() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="mx-auto grid size-40 place-items-center rounded-full border border-white/15 bg-white/5 backdrop-blur"
      animate={reduce ? undefined : { rotate: [0, 4, -4, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
    >
      <Sparkles size={48} className="text-[#ffd9a8]" />
    </motion.div>
  );
}

// ─── Quest map ────────────────────────────────────────────────────────────────
type Step = { key: string; label: string; sub: string; language?: TargetLanguage; color: string; done: boolean };

function buildSteps(target: BeltTarget, progress: TargetProgress, start: Levels): Step[] {
  if (progress.languages.length) {
    return progress.languages.flatMap(({ language, goal, gained }) =>
      Array.from({ length: goal }, (_, index) => {
        const belt = beltOf(Math.min(BELT_SLOTS, start[language] + index + 1));
        return {
          key: `${language}-${index}`,
          label: `${belt.name} belt`,
          sub: TARGET_LANGUAGE_LABELS[language],
          language,
          color: belt.color,
          done: index < gained,
        };
      }),
    );
  }
  const palette = ["#f2c230", "#e8883a", "#3dbb6f", "#a36bd4", "#4aa3e0", "#e0493e"];
  return Array.from({ length: target.total_gain ?? 0 }, (_, index) => ({
    key: `total-${index}`,
    label: `Belt ${index + 1}`,
    sub: "Any language",
    color: palette[index % palette.length],
    done: index < progress.gained,
  }));
}

function QuestMap({ target, progress, start, now }: { target: BeltTarget; progress: TargetProgress; start: Levels; now: Levels }) {
  const reduce = useReducedMotion();
  const steps = useMemo(() => buildSteps(target, progress, start), [target, progress, start]);
  const currentIndex = steps.findIndex((step) => !step.done);
  const gap = 150;
  const width = (steps.length + 1) * gap + 80;
  const height = 270;
  // Start flag, one node per belt, then the trophy.
  const points = Array.from({ length: steps.length + 2 }, (_, index) => ({
    x: 40 + index * gap,
    y: index % 2 === 0 ? 180 : 100,
  }));
  const path = points
    .map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const prev = points[index - 1];
      const mid = (prev.x + point.x) / 2;
      return `C ${mid} ${prev.y}, ${mid} ${point.y}, ${point.x} ${point.y}`;
    })
    .join(" ");
  const doneCount = steps.filter((step) => step.done).length;
  const reached = progress.done ? 1 : doneCount / (steps.length + 1);
  const totalNow = TARGET_LANGUAGES.reduce((sum, language) => sum + now[language], 0);

  return (
    <Frame>
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 py-4">
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-brand-text">Quest map</p>
          <h2 className="font-display text-[20px] font-bold tracking-[-0.02em]">
            {progress.done ? "Every checkpoint cleared" : `Checkpoint ${doneCount + 1} of ${steps.length}`}
          </h2>
        </div>
        <p className="text-[12.5px] text-muted">
          {totalNow} belts held in total · checkpoints clear after each weekly test
        </p>
      </div>
      <div className="overflow-x-auto">
        <div className="relative mx-auto" style={{ width, height }}>
          <svg width={width} height={height} className="absolute inset-0" aria-hidden="true">
            <path d={path} fill="none" stroke="var(--line-strong)" strokeWidth={6} strokeLinecap="round" strokeDasharray="2 14" />
            <motion.path
              d={path}
              fill="none"
              stroke="url(#quest-trail)"
              strokeWidth={6}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: reached }}
              viewport={{ once: true }}
              transition={{ duration: reduce ? 0 : 1.6, ease: [0.16, 1, 0.3, 1] }}
            />
            <defs>
              <linearGradient id="quest-trail" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ffb36b" />
                <stop offset="100%" stopColor="#ef3837" />
              </linearGradient>
            </defs>
          </svg>

          <MapNode x={points[0].x} y={points[0].y} label="Start" sub={monthLabel(target.month).split(" ")[0]} state="done" icon={<Flag size={18} />} color="#ffb36b" delay={0} />
          {steps.map((step, index) => (
            <MapNode
              key={step.key}
              x={points[index + 1].x}
              y={points[index + 1].y}
              label={step.label}
              sub={step.sub}
              language={step.language}
              color={step.color}
              state={step.done ? "done" : index === currentIndex ? "current" : "locked"}
              delay={0.15 + index * 0.08}
            />
          ))}
          <MapNode
            x={points.at(-1)!.x}
            y={points.at(-1)!.y}
            label={progress.done ? "Complete!" : "Target"}
            sub={describeTarget(target)}
            state={progress.done ? "done" : "locked"}
            icon={<Trophy size={20} />}
            color="#f2c230"
            delay={0.2 + steps.length * 0.08}
            big
          />
        </div>
      </div>
    </Frame>
  );
}

function MapNode({
  x,
  y,
  label,
  sub,
  state,
  color,
  language,
  icon,
  delay,
  big = false,
}: {
  x: number;
  y: number;
  label: string;
  sub: string;
  state: "done" | "current" | "locked";
  color: string;
  language?: TargetLanguage;
  icon?: React.ReactNode;
  delay: number;
  big?: boolean;
}) {
  const reduce = useReducedMotion();
  const size = big ? 64 : 52;
  return (
    <motion.div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ left: x, top: y }}
      initial={{ opacity: 0, scale: 0.6 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay: reduce ? 0 : delay, type: "spring", stiffness: 260, damping: 18 }}
    >
      <div className="relative" style={{ width: size, height: size }}>
        {state === "current" && !reduce ? (
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full"
            style={{ boxShadow: `0 0 0 3px ${color}` }}
            animate={{ scale: [1, 1.45], opacity: [0.8, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          />
        ) : null}
        <motion.div
          whileHover={{ scale: 1.08, rotate: -4 }}
          className="relative grid size-full place-items-center rounded-full border-2 font-display text-white shadow-[var(--card-shadow)]"
          style={
            state === "locked"
              ? { background: "var(--sunken)", borderColor: "var(--line-strong)", color: "var(--faint)" }
              : {
                  background: `radial-gradient(circle at 30% 25%, color-mix(in srgb, ${color} 55%, white), ${color})`,
                  borderColor: `color-mix(in srgb, ${color} 70%, black)`,
                  boxShadow: state === "current" ? `0 0 24px ${color}` : undefined,
                }
          }
        >
          {icon ?? (state === "done" ? <Check size={22} strokeWidth={3} /> : state === "locked" ? <Lock size={18} /> : <Zap size={22} />)}
          {language ? (
            <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full border border-line bg-surface">
              <LanguageLogo language={language} size={14} />
            </span>
          ) : null}
        </motion.div>
      </div>
      <div className="mt-2 w-32 text-center">
        <p className={`text-[12.5px] font-semibold ${state === "locked" ? "text-muted" : "text-ink"}`}>{label}</p>
        <p className="truncate text-[11px] text-muted">{sub}</p>
        {state === "current" ? (
          <span className="mt-1 inline-block rounded-full bg-action px-2 py-0.5 text-[10.5px] font-semibold text-white">You are here</span>
        ) : null}
      </div>
    </motion.div>
  );
}

// ─── Belt ladder ──────────────────────────────────────────────────────────────
function BeltLadder({ now, start, progress }: { now: Levels; start: Levels; progress?: TargetProgress }) {
  const goals = new Map(progress?.languages.map((item) => [item.language, item]) ?? []);
  return (
    <Frame>
      <div className="px-5 py-4">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-brand-text">Your belts</p>
        <h2 className="font-display text-[20px] font-bold tracking-[-0.02em]">The ladder</h2>
      </div>
      <div className="grid gap-px bg-line sm:grid-cols-2">
        {TARGET_LANGUAGES.map((language, index) => {
          const level = now[language];
          const belt = beltOf(level);
          const next = level < BELT_SLOTS ? beltOf(level + 1) : null;
          const gained = Math.max(0, level - start[language]);
          const goal = goals.get(language);
          return (
            <motion.div
              key={language}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.07 }}
              whileHover={{ y: -3 }}
              className="relative overflow-hidden bg-surface px-5 py-4"
            >
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-1"
                style={{ background: beltFill(belt), opacity: level ? 1 : 0.4 }}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 font-display text-[15px] font-bold">
                  <LanguageLogo language={language} size={22} /> {TARGET_LANGUAGE_LABELS[language]}
                </span>
                {goal ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      goal.gained >= goal.goal ? "bg-success-soft text-success-text" : "bg-brand-soft text-brand-text"
                    }`}
                  >
                    {goal.gained}/{goal.goal} this month
                  </span>
                ) : gained ? (
                  <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success-text">+{gained} this month</span>
                ) : null}
              </div>
              <div className="mt-3">
                <BeltStrip level={level} size="sm" delay={index * 0.05} />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <BeltTag level={level} compact />
                <span className="text-[12px] text-muted">
                  {next ? (
                    <>
                      Next: <span className="font-medium text-ink-2">{next.name}</span>
                    </>
                  ) : (
                    "Top of the ladder"
                  )}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Frame>
  );
}

// ─── Daily quests (saved on this device) ──────────────────────────────────────
const dayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be blocked; progress still shows for this visit.
  }
}

type Streak = { last: string; count: number };

function DailyQuests() {
  // Fixed for this visit, so a render never sees a different day.
  const [{ today, yesterday }] = useState(() => {
    const now = new Date();
    return { today: dayKey(now), yesterday: dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)) };
  });
  const storeKey = `dojo-quests-${today}`;
  const [doneIds, setDoneIds] = useState<string[]>(() => readJson<string[]>(storeKey, []));
  const [streak, setStreak] = useState<Streak>(() => readJson<Streak>("dojo-quest-streak", { last: "", count: 0 }));
  const total = DAILY_QUESTS.reduce((sum, quest) => sum + quest.xp, 0);
  const xp = DAILY_QUESTS.filter((quest) => doneIds.includes(quest.id)).reduce((sum, quest) => sum + quest.xp, 0);
  const shownStreak = streak.last === today || streak.last === yesterday ? streak.count : 0;

  function toggle(id: string) {
    const next = doneIds.includes(id) ? doneIds.filter((item) => item !== id) : [...doneIds, id];
    setDoneIds(next);
    writeJson(storeKey, next);
    // The first quest of the day extends the streak.
    if (next.length && streak.last !== today) {
      const updated = { last: today, count: streak.last === yesterday ? streak.count + 1 : 1 };
      setStreak(updated);
      writeJson("dojo-quest-streak", updated);
    }
  }

  return (
    <Frame>
      <div className="flex items-end justify-between gap-3 px-5 py-4">
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-brand-text">Daily quests</p>
          <h2 className="font-display text-[20px] font-bold tracking-[-0.02em]">Today’s training</h2>
        </div>
        <motion.span
          key={shownStreak}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#ffb36b]/15 px-3 py-1 text-[13px] font-semibold text-[#c2620c] dark:text-[#ffb36b]"
          title="Days in a row with at least one quest done"
        >
          <Flame size={15} /> {shownStreak} day streak
        </motion.span>
      </div>
      <div className="px-5 py-4">
        <div className="flex items-center justify-between text-[12.5px]">
          <span className="font-medium text-ink-2">
            <span className="tabular-nums">{xp}</span> / {total} XP today
          </span>
          {xp === total ? <span className="font-semibold text-success-text">All done 🎉</span> : null}
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-sunken">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #ffb36b, #ef3837)" }}
            animate={{ width: `${(xp / total) * 100}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
        <ClickSpark sparkColor="#ef3837" sparkCount={10} sparkRadius={22}>
          <ul className="mt-4 flex flex-col gap-2">
            {DAILY_QUESTS.map((quest) => {
              const done = doneIds.includes(quest.id);
              return (
                <li key={quest.id}>
                  <button
                    type="button"
                    aria-pressed={done}
                    onClick={() => toggle(quest.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-[13.5px] transition ${
                      done ? "border-success-text/30 bg-success-soft" : "border-line hover:border-line-strong hover:bg-sunken/60"
                    }`}
                  >
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-md border transition ${
                        done ? "border-success-text bg-success-text text-white" : "border-line-strong"
                      }`}
                    >
                      <AnimatePresence>
                        {done ? (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                            <Check size={13} strokeWidth={3} />
                          </motion.span>
                        ) : null}
                      </AnimatePresence>
                    </span>
                    <span className={`flex-1 ${done ? "text-muted line-through" : "text-ink"}`}>{quest.label}</span>
                    <span className="text-[11.5px] font-semibold tabular-nums text-brand-text">+{quest.xp} XP</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </ClickSpark>
        <p className="mt-3 text-[11.5px] text-faint">Saved on this device. Resets every day.</p>
      </div>
    </Frame>
  );
}

// ─── Training ground ──────────────────────────────────────────────────────────
function TrainingGround({ focus }: { focus: TargetLanguage[] }) {
  const order = [...focus, ...TARGET_LANGUAGES.filter((language) => !focus.includes(language))];
  const [language, setLanguage] = useState<TargetLanguage>(order[0]);
  return (
    <Frame>
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 py-4">
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-brand-text">Training ground</p>
          <h2 className="font-display text-[20px] font-bold tracking-[-0.02em]">Tips, tricks and where to learn</h2>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl bg-sunken p-1" role="tablist" aria-label="Language">
          {order.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={language === item}
              onClick={() => setLanguage(item)}
              className="relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium"
            >
              {language === item ? (
                <motion.span layoutId="training-tab" className="absolute inset-0 rounded-lg bg-surface shadow-[var(--card-shadow)] ring-[0.5px] ring-line" />
              ) : null}
              <span className={`relative inline-flex items-center gap-1.5 ${language === item ? "text-ink" : "text-muted"}`}>
                <LanguageLogo language={item} size={15} />
                {TARGET_LANGUAGE_LABELS[item]}
                {focus.includes(item) ? <span className="size-1.5 rounded-full bg-action" title="In your target" /> : null}
              </span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={language}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="grid gap-5 px-5 py-5 lg:grid-cols-[1.6fr_1fr]"
        >
          <div>
            <p className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
              <Lightbulb size={15} className="text-[#e8a33a]" /> Tap a card to reveal the trick
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {LANGUAGE_TIPS[language].map((tip, index) => (
                <TipCard key={tip.title} tip={tip} index={index} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
              <BookOpen size={15} className="text-brand" /> Free places to learn
            </p>
            <ul className="flex flex-col gap-2">
              {LANGUAGE_RESOURCES[language].map((resource, index) => (
                <motion.li
                  key={resource.url}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.06 }}
                >
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-start gap-3 rounded-lg border border-line px-3.5 py-3 transition hover:border-line-strong hover:bg-sunken/60"
                  >
                    <span className="mt-0.5 rounded-md bg-sunken px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">
                      {resource.kind}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
                        {resource.name}
                        <ExternalLink size={12} className="text-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
                      </span>
                      <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{resource.what}</span>
                    </span>
                  </a>
                </motion.li>
              ))}
            </ul>
          </div>
        </motion.div>
      </AnimatePresence>
    </Frame>
  );
}

function TipCard({ tip, index }: { tip: (typeof LANGUAGE_TIPS)["python"][number]; index: number }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={() => setOpen((value) => !value)}
      aria-expanded={open}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative min-h-[148px] text-left [perspective:900px]"
    >
      <motion.div
        className="relative size-full min-h-[148px] [transform-style:preserve-3d]"
        animate={{ rotateY: open ? 180 : 0 }}
        transition={{ duration: reduce ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="absolute inset-0 flex flex-col justify-between rounded-xl border border-line bg-gradient-to-br from-surface to-sunken p-4 [backface-visibility:hidden]">
          <span className="grid size-8 place-items-center rounded-lg bg-[#e8a33a]/15 text-[#c27a12] dark:text-[#ffc56b]">
            <Lightbulb size={16} />
          </span>
          <div>
            <p className="font-display text-[15px] font-bold leading-snug tracking-[-0.01em] text-ink">{tip.title}</p>
            <p className="mt-1 text-[11.5px] text-faint">Tap to reveal</p>
          </div>
        </div>
        <div className="absolute inset-0 flex flex-col gap-2 overflow-hidden rounded-xl border border-line-strong bg-surface p-4 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <p className="text-[12.5px] leading-relaxed text-ink-2">{tip.body}</p>
          {tip.code ? (
            <pre className="overflow-x-auto rounded-lg bg-[#0b0b0e] px-3 py-2 font-mono text-[11.5px] leading-relaxed text-[#ffd9a8]">
              {tip.code}
            </pre>
          ) : null}
        </div>
      </motion.div>
    </motion.button>
  );
}
