"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ExternalLink } from "lucide-react";
import { getCurrentUserProfile, type CurrentUserProfile } from "@/lib/auth/profile";
import { useCachedProfile } from "@/lib/auth/use-cached-profile";
import { Frame, FrameTitle, Page } from "@/components/ui/frame";
import { FormBanner } from "@/components/ui/form";
import { PageState } from "@/components/ui/skeleton";
import { Heatmap } from "@/components/leetcode/heatmap";
import { LeetCodeCardView } from "@/components/leetcode/leetcode-card";
import { LeetCodeLogo } from "@/components/leetcode/leetcode-logo";
import { AchievementGrid, AchievementToasts, useAchievements } from "@/components/leetcode/achievements";
import { istDay, type LeetCodeCard } from "@/lib/leetcode";

type Recent = { title_slug: string; title: string | null; solved_at: string };

/** A student's own LeetCode: link the account, see today's status and the year's calendar. */
export default function MyLeetCodePage() {
  const router = useRouter();
  const cached = useCachedProfile();
  const [state, setState] = useState<CurrentUserProfile | { status: "loading" }>(cached ?? { status: "loading" });
  useEffect(() => {
    let mounted = true;
    getCurrentUserProfile().then((result) => mounted && setState(result));
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (state.status === "unauthenticated") router.replace("/login");
    if (state.status === "authenticated" && state.profile.role !== "student") router.replace("/leetcode");
  }, [state, router]);

  if (state.status === "loading") return <PageState message="Checking your account…" loading />;
  if (state.status !== "authenticated" || state.profile.role !== "student") return <PageState message="Redirecting…" loading />;
  return <MyLeetCode readOnly={Boolean(state.profile.viewing_as)} />;
}

function MyLeetCode({ readOnly }: { readOnly: boolean }) {
  const [today] = useState(() => istDay());
  const [card, setCard] = useState<LeetCodeCard | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"solved" | "activity">("activity");
  const achievements = useAchievements();

  useEffect(() => {
    let active = true;
    fetch("/api/leetcode/me", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ card?: LeetCodeCard | null; recent?: Recent[]; error?: string }>)
      .then((result) => {
        if (!active) return;
        setCard(result.card ?? null);
        setRecent(result.recent ?? []);
        setUsername(result.card?.username ?? "");
        if (result.error) setError(result.error);
      })
      .catch(() => active && setError("Couldn’t load your LeetCode data."))
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, []);

  async function save(next: string) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/leetcode/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: next }),
      });
      const result = (await response.json()) as { card?: LeetCodeCard; recent?: Recent[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Couldn’t save.");
      setCard(result.card ?? null);
      setRecent(result.recent ?? []);
      setUsername(result.card?.username ?? "");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Couldn’t save.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <PageState message="Loading your LeetCode…" loading />;
  const linked = Boolean(card?.username);
  const days = view === "solved" ? (card?.solved_days ?? {}) : (card?.activity_days ?? {});
  const yearTotal = Object.values(days).reduce((sum, value) => sum + value, 0);

  return (
    <Page>
      <div className="flex flex-col gap-4">
        <Frame>
          <FrameTitle
            eyebrow="Practice"
            title="My LeetCode"
            description="Solve at least one new problem every day (12 am to 12 am IST) to keep your card green. Re-solving a problem you already solved doesn’t count, but a problem you failed before and finally get accepted does."
          />
          <form
            data-tour="lc-link"
            className="flex flex-wrap items-center gap-2 px-4 py-4 sm:px-5"
            onSubmit={(event) => {
              event.preventDefault();
              void save(username);
            }}
          >
            <label className="flex h-10 min-w-64 flex-1 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3">
              <LeetCodeLogo size={16} />
              <span className="sr-only">LeetCode username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                disabled={readOnly}
                placeholder="Your LeetCode username or profile link"
                className="w-full bg-transparent text-[14px] outline-none placeholder:text-faint"
              />
            </label>
            <button
              type="submit"
              disabled={saving || readOnly || !username.trim() || username === card?.username}
              className="h-10 rounded-lg bg-action px-4 text-[13.5px] font-semibold text-white transition hover:bg-action-hover disabled:opacity-60"
            >
              {saving ? "Saving…" : linked ? "Change" : "Link LeetCode"}
            </button>
          </form>
          {!linked && !readOnly ? (
            <div className="px-4 pb-4 sm:px-5">
              <FormBanner tone="error">
                Adding your LeetCode is required. Link your account to keep using Dojo.
              </FormBanner>
            </div>
          ) : null}
          {error ? (
            <div className="px-4 pb-4 sm:px-5">
              <FormBanner tone="error">{error}</FormBanner>
            </div>
          ) : null}
        </Frame>

        {card ? <LeetCodeCardView card={card} today={today} self /> : null}
        <AchievementToasts list={achievements} />
        {linked && achievements?.length ? (
          <Frame>
            <AchievementGrid list={achievements} />
          </Frame>
        ) : null}

        {linked && card ? (
          <div className="grid items-start gap-4 xl:grid-cols-[1fr_340px]">
            <Frame>
              <div className="flex flex-wrap items-end justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-brand-text">The year</p>
                  <h2 className="font-display text-[20px] font-bold tracking-[-0.02em]">
                    {yearTotal} {view === "solved" ? "new problems" : "submissions"} in the last year
                  </h2>
                </div>
                <div className="flex rounded-lg bg-sunken p-0.5" role="group" aria-label="Calendar">
                  {(
                    [
                      ["activity", "LeetCode activity"],
                      ["solved", "New problems (tracked)"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={view === value}
                      onClick={() => setView(value)}
                      className={`rounded-md px-2.5 py-1 text-[12.5px] font-medium transition ${
                        view === value ? "bg-surface text-ink shadow-[var(--card-shadow)] ring-[0.5px] ring-line" : "text-muted hover:text-ink"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto px-5 py-5">
                <Heatmap days={days} today={today} weeks={53} cell={12} gap={3} showMonths unit={view === "solved" ? "problems" : "submissions"} />
                <p className="mt-3 text-[11.5px] text-faint">
                  {view === "solved"
                    ? "Counted by this app from the day you linked LeetCode."
                    : "Straight from LeetCode: every submission, accepted or not."}
                </p>
              </div>
            </Frame>

            <Frame>
              <div className="px-5 py-4">
                <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-brand-text">Recently solved</p>
                <h2 className="font-display text-[20px] font-bold tracking-[-0.02em]">New problems</h2>
              </div>
              {recent.length ? (
                <ul className="divide-y divide-line">
                  {recent.map((item, index) => (
                    <motion.li key={item.title_slug} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.03 }}>
                      <a
                        href={`https://leetcode.com/problems/${item.title_slug}/`}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-sunken/50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-medium text-ink">{item.title ?? item.title_slug}</span>
                          <span className="text-[11.5px] text-muted">
                            {new Date(item.solved_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                          </span>
                        </span>
                        <ExternalLink size={13} className="shrink-0 text-faint group-hover:text-ink" />
                      </a>
                    </motion.li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-6 text-[13px] text-muted">
                  Nothing tracked yet. Solve a new problem on LeetCode and it shows up here within a few minutes.
                </p>
              )}
            </Frame>
          </div>
        ) : null}
      </div>
    </Page>
  );
}
