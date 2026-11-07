"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, ChevronDown, Compass, ExternalLink, TriangleAlert } from "lucide-react";
import { AuroraShader } from "@/components/fx/aurora-shader";
import { CodeRain } from "@/components/fx/code-rain";
import { LiquidGlass } from "@/components/fx/liquid-glass";
import { RevealText } from "@/components/fx/reveal-text";
import { LeetCodeLogo } from "@/components/leetcode/leetcode-logo";
import { BeltStrip, BeltTag, LanguageLogo } from "@/components/belts/belts";
import { Frame, Page } from "@/components/ui/frame";
import { PageState } from "@/components/ui/skeleton";
import { DailyChallenge } from "@/components/practice/daily-challenge";
import { AchievementToasts, useAchievements } from "@/components/leetcode/achievements";
import { beltOf } from "@/lib/belts";
import { TARGET_LANGUAGES, TARGET_LANGUAGE_LABELS, type Levels, type TargetLanguage } from "@/lib/belt-targets";
import { SYLLABUS, type Difficulty, type MoreLink, type TopicPlan } from "@/lib/dojo-syllabus";

/** Belt name and colour by Dojo level (1-10). The shared ladder stops at Sr. Red, so Black is added here. */
const dojoBelt = (level: number) => ({
  name: SYLLABUS.find((belt) => belt.level === level)?.name ?? beltOf(level).name,
  color: level >= 10 ? "#3a3a40" : beltOf(level).color,
});

type Plan = { level: number; name: string; band?: string; focus: string; outcome?: string; topics: TopicPlan[] };
type Suggestions = {
  levels: Levels;
  language: TargetLanguage;
  level: number;
  focusLevel: number | null;
  mastered: boolean;
  leetcode: { username: string | null; personalised: boolean };
  next: Plan | null;
  review: Plan | null;
  solvedCount: number;
};

/** "r,g,b" from a hex colour, for canvas effects. */
const hexToRgb = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};
/** The colour mixed towards black: 0 = black, 1 = unchanged. */
const shade = (hex: string, amount: number) => {
  const n = parseInt(hex.replace("#", ""), 16);
  const part = (value: number) => Math.round(value * amount).toString(16).padStart(2, "0");
  return `#${part((n >> 16) & 255)}${part((n >> 8) & 255)}${part(n & 255)}`;
};

const DOT: Record<Difficulty, string> = { Easy: "bg-emerald-500", Medium: "bg-amber-500", Hard: "bg-red-500" };
const leetcodeUrl = (slug: string) => `https://leetcode.com/problems/${slug}/`;

/** Belt-based practice: next belt's topics, weakest first, with LeetCode problems to solve. */
export function PracticePage() {
  const [language, setLanguage] = useState<TargetLanguage | null>(null);
  // null = their next belt in that language; otherwise any belt they pick.
  const [belt, setBelt] = useState<number | null>(null);
  const [data, setData] = useState<Suggestions | null>(null);
  const [error, setError] = useState("");
  const achievements = useAchievements();

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams();
    if (language) query.set("language", language);
    if (belt) query.set("belt", String(belt));
    fetch(`/api/suggestions?${query}`, { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as Suggestions & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Couldn’t load suggestions.");
        if (active) {
          setData(result);
          setError("");
        }
      })
      .catch((loadError) => active && setError(loadError instanceof Error ? loadError.message : "Couldn’t load suggestions."));
    return () => {
      active = false;
    };
  }, [language, belt]);

  if (error && !data) return <PageState message="Couldn’t load your practice plan" detail={error} />;
  if (!data) return <PageState message="Reading your belts…" loading />;

  return (
    <Page className="pb-16">
      <AchievementToasts list={achievements} />
      <div className="flex flex-col gap-4">
        <Hero
          data={data}
          onLanguage={(next) => {
            setLanguage(next);
            setBelt(null);
          }}
          onBelt={setBelt}
        />
        {!data.leetcode.personalised ? <LinkBanner linked={Boolean(data.leetcode.username)} /> : null}
        {data.next ? (
          <>
            {data.focusLevel === data.level + 1 ? <DailyChallenge /> : null}
            <TopicGrid
              plan={data.next}
              title={`${data.next.name} belt topics`}
              eyebrow={
                data.next.level === data.level + 1 ? "Your next belt" : data.next.level <= data.level ? "A belt you’ve earned · revision" : "A belt further ahead"
              }
            />
          </>
        ) : (
          <Frame>
            <p className="px-6 py-10 text-center text-[14px] text-muted">You hold every belt in {TARGET_LANGUAGE_LABELS[data.language]}. Keep sharp with the review below.</p>
          </Frame>
        )}
        {data.review ? <Review plan={data.review} /> : null}
        <p className="px-1 text-[12px] leading-relaxed text-faint">
          Try each problem on your own first. Stuck? Use the GPS order from the Dojo guide: look up the concept (not the answer), talk it through with a peer, then ask your mentor.
        </p>
      </div>
    </Page>
  );
}

function Hero({
  data,
  onLanguage,
  onBelt,
}: {
  data: Suggestions;
  onLanguage: (language: TargetLanguage) => void;
  onBelt: (belt: number | null) => void;
}) {
  const target = dojoBelt(data.next ? data.next.level : Math.max(1, data.level));
  const revising = Boolean(data.next && data.next.level <= data.level);
  return (
    <section className="relative isolate min-h-[440px] overflow-hidden rounded-2xl border border-white/10 bg-[#07070a] text-white shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)]">
      <AuroraShader base="#060609" mid={shade(target.color, 0.22)} glow={target.color} intensity={1.05} />
      <CodeRain color="255,255,255" accent={hexToRgb(target.color)} density={0.9} />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#07070a] via-[#07070a]/70 to-transparent" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#07070a] to-transparent" />

      <div className="relative flex min-h-[440px] flex-col justify-between gap-8 px-6 pb-6 pt-8 sm:px-10 sm:pt-10">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-white/55"
          >
            <span className="size-1.5 animate-pulse rounded-full" style={{ background: target.color, boxShadow: `0 0 12px ${target.color}` }} />
            Practice · {TARGET_LANGUAGE_LABELS[data.language]}
          </motion.p>
          <h1 key={`${data.language}-${data.focusLevel}`} className="mt-4 max-w-3xl font-display text-[40px] font-extrabold leading-[0.98] tracking-[-0.045em] sm:text-[64px]">
            {data.next ? (
              <RevealText
                parts={[
                  revising ? "Revising" : "Training for",
                  <span key="belt" style={{ color: target.color, textShadow: `0 0 40px ${target.color}66` }}>
                    {data.next.name}
                  </span>,
                  "belt",
                ]}
              />
            ) : (
              <RevealText parts={["Every belt earned"]} />
            )}
          </h1>
          {data.next ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/60"
            >
              <span className="font-semibold text-white/90">{data.next.focus}.</span> {data.next.outcome}
            </motion.p>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <BeltStrip level={data.level} size="sm" tone="dark" />
            <BeltTag level={data.level} compact />
          </div>
        </div>

        {/* Floating controls: the one place this page uses glass. */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, type: "spring", stiffness: 160, damping: 20 }}>
          <LiquidGlass className="rounded-2xl p-2">
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Language">
              {TARGET_LANGUAGES.map((language) => {
                const active = language === data.language;
                return (
                  <button
                    key={language}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onLanguage(language)}
                    className="relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-left"
                  >
                    {active ? (
                      <motion.span
                        layoutId="practice-language"
                        className="absolute inset-0 rounded-xl bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    ) : null}
                    <span className="relative">
                      <LanguageLogo language={language} size={20} />
                    </span>
                    <span className="relative">
                      <span className={`block text-[13px] font-semibold ${active ? "text-white" : "text-white/70"}`}>{TARGET_LANGUAGE_LABELS[language]}</span>
                      <span className="block text-[11px] text-white/45">{beltOf(data.levels[language]).name} belt</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mx-1 my-2 h-px bg-white/10" />
            <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Belt">
              {Array.from({ length: 10 }, (_, index) => index + 1).map((level) => {
                const belt = dojoBelt(level);
                const selected = level === data.focusLevel;
                const earned = level <= data.level;
                const isNext = level === data.level + 1;
                return (
                  <button
                    key={level}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onBelt(isNext ? null : level)}
                    title={`${belt.name} belt${earned ? " · earned" : isNext ? " · your next belt" : ""}`}
                    className="relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold"
                  >
                    {selected ? (
                      <motion.span
                        layoutId="practice-belt"
                        className="absolute inset-0 rounded-lg"
                        style={{ background: `${belt.color}33`, boxShadow: `inset 0 0 0 1px ${belt.color}aa, 0 0 18px ${belt.color}55` }}
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    ) : null}
                    <span
                      aria-hidden="true"
                      className="relative h-2.5 w-4 rounded-[2px]"
                      style={{ background: belt.color, transform: "skewX(-14deg)", opacity: earned || selected || isNext ? 1 : 0.4 }}
                    />
                    <span className={`relative ${selected ? "text-white" : "text-white/60 hover:text-white"}`}>{belt.name}</span>
                    {earned ? <Check size={11} strokeWidth={3} className="relative text-emerald-300" /> : null}
                    {isNext ? <span className="relative rounded bg-white/15 px-1 text-[10px] font-medium text-white/80">next</span> : null}
                  </button>
                );
              })}
            </div>
          </LiquidGlass>
        </motion.div>
      </div>
    </section>
  );
}

function LinkBanner({ linked }: { linked: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3">
      <p className="flex items-center gap-2 text-[13.5px] text-ink">
        <Compass size={16} className="text-amber-600 dark:text-amber-400" />
        {linked
          ? "We couldn’t read your LeetCode topic stats right now, so topics are in syllabus order."
          : "Link your LeetCode account to get picks aimed at your weakest topics and to hide problems you’ve already solved."}
      </p>
      {!linked ? (
        <Link href="/student/leetcode" className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink hover:underline">
          Link LeetCode <ArrowRight size={14} />
        </Link>
      ) : null}
    </div>
  );
}

function TopicGrid({ plan, title, eyebrow }: { plan: Plan; title: string; eyebrow: string }) {
  const color = dojoBelt(plan.level).color;
  const cleared = plan.topics.filter((topic) => topic.problems.every((problem) => problem.solved)).length;
  return (
    <Frame>
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 py-4">
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-brand-text">{eyebrow}</p>
          <h2 className="font-display text-[20px] font-bold tracking-[-0.02em]">{title}</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">Your road through this belt: weakest topics first, solved problems drop off.</p>
        </div>
        <span className="text-[12.5px] font-medium text-muted">
          <span className="font-display text-[18px] font-bold text-ink tabular-nums">{cleared}</span>/{plan.topics.length} topics cleared
        </span>
      </div>
      <div className="px-5 pb-5 pt-1">
        <Roadmap topics={plan.topics} color={color} />
      </div>
    </Frame>
  );
}

/** Topics as stops on one trail; each stop lists its open problems as small chips. */
function Roadmap({ topics, color }: { topics: TopicPlan[]; color: string }) {
  const reduce = useReducedMotion();
  const firstOpen = topics.findIndex((topic) => topic.problems.some((problem) => !problem.solved));
  return (
    <ol className="relative">
      {/* The trail. */}
      <span aria-hidden="true" className="absolute bottom-4 left-[17px] top-4 w-[2px] rounded-full bg-line" />
      <motion.span
        aria-hidden="true"
        className="absolute left-[17px] top-4 w-[2px] origin-top rounded-full"
        style={{ background: `linear-gradient(${color}, ${color}55)`, height: "calc(100% - 2rem)" }}
        initial={{ scaleY: 0 }}
        whileInView={{ scaleY: firstOpen < 0 ? 1 : Math.max(0.04, firstOpen / Math.max(1, topics.length - 1)) }}
        viewport={{ once: true }}
        transition={{ duration: reduce ? 0 : 1.2, ease: [0.16, 1, 0.3, 1] }}
      />
      {topics.map((topic, index) => (
        <Stop key={topic.name} topic={topic} index={index} color={color} current={index === firstOpen} />
      ))}
    </ol>
  );
}

function Stop({ topic, index, color, current }: { topic: TopicPlan; index: number; color: string; current: boolean }) {
  const reduce = useReducedMotion();
  const total = topic.problems.length;
  const done = topic.problems.filter((problem) => problem.solved).length;
  const left = topic.problems.filter((problem) => !problem.solved);
  const cleared = left.length === 0;
  const fraction = done / Math.max(1, total);
  const ring = 2 * Math.PI * 15;
  return (
    <motion.li
      initial={{ opacity: 0, x: -10 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: reduce ? 0 : Math.min(index, 8) * 0.06 }}
      className="relative flex gap-4 pb-5 last:pb-0"
    >
      {/* Node: numbered, with a progress ring; pulses on the current stop. */}
      <span className="relative z-10 grid size-9 shrink-0 place-items-center">
        {current && !reduce ? (
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full"
            style={{ boxShadow: `0 0 0 2px ${color}` }}
            animate={{ scale: [1, 1.5], opacity: [0.7, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          />
        ) : null}
        <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
          <circle cx="18" cy="18" r="15" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="2.5" />
          <motion.circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke={cleared ? "var(--success-text)" : color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={ring}
            initial={{ strokeDashoffset: ring }}
            whileInView={{ strokeDashoffset: ring * (1 - fraction) }}
            viewport={{ once: true }}
            transition={{ duration: reduce ? 0 : 0.9, delay: 0.2 }}
          />
        </svg>
        <span className={`relative text-[12px] font-bold tabular-nums ${cleared ? "text-success-text" : current ? "text-ink" : "text-muted"}`}>
          {cleared ? <Check size={14} strokeWidth={3} /> : index + 1}
        </span>
      </span>

      <div className="min-w-0 flex-1 pt-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h3 className={`font-display text-[15px] font-bold tracking-[-0.01em] ${cleared ? "text-muted" : "text-ink"}`}>{topic.name}</h3>
          {topic.weak && !cleared ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-px text-[10.5px] font-semibold text-amber-700 dark:text-amber-300">
              <TriangleAlert size={10} /> Focus
            </span>
          ) : null}
          <span className="text-[11.5px] text-faint">
            {done}/{total} done{topic.tagSolved !== null ? ` · ${topic.tagSolved} on LeetCode` : ""}
          </span>
        </div>
        <p className="truncate text-[12px] text-muted">{topic.summary}</p>
        {cleared ? (
          <p className="mt-1.5 text-[12px] font-medium text-success-text">Cleared. Every suggested problem here is solved.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {left.map((problem) => (
              <li key={problem.slug}>
                <a
                  href={leetcodeUrl(problem.slug)}
                  target="_blank"
                  rel="noreferrer"
                  title={`${problem.title} · ${problem.difficulty} · open on LeetCode`}
                  className="group inline-flex max-w-[22rem] items-center gap-1.5 rounded-lg border border-line bg-surface-2 py-1 pl-1.5 pr-2 text-[12.5px] text-ink transition hover:-translate-y-px hover:border-[#FFA116]/60 hover:shadow-[0_6px_16px_-8px_rgba(255,161,22,0.6)]"
                >
                  <LeetCodeLogo size={13} />
                  <span className="truncate">{problem.title}</span>
                  <span className={`size-1.5 shrink-0 rounded-full ${DOT[problem.difficulty]}`} aria-label={problem.difficulty} />
                </a>
              </li>
            ))}
          </ul>
        )}
        {topic.more?.length && !cleared ? <MoreLinks links={topic.more} /> : null}
      </div>
    </motion.li>
  );
}

function MoreLinks({ links }: { links: MoreLink[] }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-faint">Also try:</span>
      {links.map((link) => (
        <a
          key={link.url + link.name}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink"
        >
          {link.name} <ExternalLink size={9} />
        </a>
      ))}
    </div>
  );
}

function Review({ plan }: { plan: Plan }) {
  const [open, setOpen] = useState(false);
  return (
    <Frame>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
        <span>
          <span className="block text-[11.5px] font-semibold uppercase tracking-[0.08em] text-brand-text">Keep it sharp</span>
          <span className="block font-display text-[18px] font-bold tracking-[-0.02em]">Review your {plan.name} belt topics</span>
        </span>
        <ChevronDown size={18} className={`text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-5 pb-5 pt-1">
              <Roadmap topics={plan.topics} color={dojoBelt(plan.level).color} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Frame>
  );
}
