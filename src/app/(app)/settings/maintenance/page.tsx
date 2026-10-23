"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUserProfile, type CurrentUserProfile } from "@/lib/auth/profile";
import { AnimatePresence } from "motion/react";
import { Clock, ExternalLink, Power, ShieldAlert, Wrench } from "lucide-react";
import { PageState } from "@/components/ui/skeleton";
import { Frame, FrameTitle, Page } from "@/components/ui/frame";
import { FormBanner } from "@/components/ui/form";
import { useNow } from "@/components/support/kit";

type Maintenance = {
  enabled: boolean;
  until: string | null;
  message: string | null;
  startedAt: string | null;
};

// null hours = "back soon", with no countdown and no automatic end.
const DURATIONS: Array<{ label: string; hours: number | null }> = [
  { label: "30 minutes", hours: 0.5 },
  { label: "1 hour", hours: 1 },
  { label: "2 hours", hours: 2 },
  { label: "4 hours", hours: 4 },
  { label: "8 hours", hours: 8 },
  { label: "Back soon", hours: null },
];

function remaining(until: string, now: number) {
  const minutes = Math.max(0, Math.round((Date.parse(until) - now) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
}

export default function MaintenanceSettingsPage() {
  const router = useRouter();
  const now = useNow();
  const [account, setAccount] = useState<CurrentUserProfile | null>(null);
  const [state, setState] = useState<Maintenance | null>(null);
  const [loadError, setLoadError] = useState("");
  const [choice, setChoice] = useState<string>("1 hour");
  const [customHours, setCustomHours] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  // Only super admins and developers may hold the switch.
  useEffect(() => {
    let active = true;
    getCurrentUserProfile().then((result) => {
      if (!active) return;
      setAccount(result);
      if (result.status === "unauthenticated") router.replace("/login");
      else if (result.status !== "authenticated" || result.profile.role !== "super_admin")
        router.replace("/");
    });
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    fetch("/api/maintenance", { cache: "no-store" })
      .then((response) => response.json())
      .then((result: { maintenance?: Maintenance }) => {
        if (result.maintenance) setState(result.maintenance);
        else setLoadError("Couldn’t read maintenance mode.");
      })
      .catch(() => setLoadError("Couldn’t read maintenance mode."));
  }, []);

  async function save(enabled: boolean) {
    setPending(true);
    setError("");
    const preset = DURATIONS.find((duration) => duration.label === choice);
    const hours = choice === "custom" ? Number(customHours) : (preset?.hours ?? null);
    if (enabled && choice === "custom" && !(hours && hours > 0 && hours <= 72)) {
      setError("Enter between 0.25 and 72 hours.");
      setPending(false);
      return;
    }
    try {
      const response = await fetch("/api/maintenance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, hours, message }),
      });
      const result = (await response.json()) as { maintenance?: Maintenance; error?: string };
      if (!response.ok || !result.maintenance) throw new Error(result.error ?? "Couldn’t save.");
      setState(result.maintenance);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Couldn’t save.");
    } finally {
      setPending(false);
    }
  }

  if (account?.status !== "authenticated" || account.profile.role !== "super_admin")
    return <PageState message="Checking your account" loading />;
  if (loadError) return <PageState message="Maintenance mode" detail={loadError} />;
  if (!state) return <PageState message="Loading maintenance mode" loading />;

  return (
    <Page>
      <Frame>
        <FrameTitle
          eyebrow="Admin"
          title="Maintenance mode"
          description="Lock the app while you test or migrate. Only developers and super admins stay in; everyone else sees the maintenance page."
          actions={
            <a
              href="/maintenance"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-line-strong px-3.5 py-2 text-[13px] font-semibold text-ink-2 transition hover:border-ink/40 hover:text-ink"
            >
              Preview page <ExternalLink size={13} />
            </a>
          }
        />

        <div className="grid gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Status */}
          <section
            className={`rounded-2xl border p-5 ${
              state.enabled
                ? "border-[color-mix(in_srgb,#f59e0b_45%,var(--line))] bg-[color-mix(in_srgb,#f59e0b_8%,var(--surface))]"
                : "border-line bg-surface-2"
            }`}
          >
            <div className="flex items-start gap-3.5">
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                  state.enabled
                    ? "bg-[color-mix(in_srgb,#f59e0b_18%,transparent)] text-[#b45309] dark:text-[#fcd34d]"
                    : "bg-success-soft text-success-text"
                }`}
              >
                {state.enabled ? <Wrench size={20} /> : <Power size={20} />}
              </span>
              <div className="min-w-0">
                <p className="font-display text-[18px] font-bold tracking-[-0.02em]">
                  {state.enabled ? "Maintenance is ON" : "The app is live"}
                </p>
                <p className="mt-1 text-[13.5px] leading-6 text-muted">
                  {state.enabled
                    ? state.until
                      ? `Ends automatically in ${remaining(state.until, now)} (${new Date(state.until).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}).`
                      : "Shows “We’ll be back soon” until you turn it off."
                    : "Everyone with an account can use Dojo Belt Analyzer."}
                </p>
                {state.enabled && state.message ? (
                  <p className="mt-2 rounded-xl bg-surface px-3 py-2 text-[13px] text-ink-2">
                    “{state.message}”
                  </p>
                ) : null}
              </div>
            </div>
            {state.enabled ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => void save(false)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-page transition hover:opacity-90 disabled:opacity-50"
              >
                <Power size={15} /> {pending ? "Turning off…" : "End maintenance now"}
              </button>
            ) : null}
          </section>

          {/* Who is affected */}
          <aside className="rounded-2xl border border-line p-5">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <ShieldAlert size={15} className="text-action" /> While it’s on
            </div>
            <ul className="mt-3 space-y-2 text-[13px] leading-5 text-muted">
              <li>✓ Developers and super admins keep full access.</li>
              <li>✕ Campus managers, mentors and students see the maintenance page.</li>
              <li>✕ Their API calls are refused, so nothing changes behind your back.</li>
              <li>↺ A timed window ends by itself — no need to remember.</li>
            </ul>
          </aside>
        </div>

        {/* Start maintenance */}
        <section className="border-t border-line px-4 py-6 sm:px-6">
          <h2 className="font-display text-[16px] font-semibold">
            {state.enabled ? "Change the window" : "Start maintenance"}
          </h2>
          <p className="mt-1 text-[13px] text-muted">How long should the app be locked?</p>
          <div role="radiogroup" aria-label="Duration" className="mt-4 flex flex-wrap gap-2">
            {[...DURATIONS.map((duration) => duration.label), "custom"].map((label) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={choice === label}
                onClick={() => setChoice(label)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition ${
                  choice === label
                    ? "border-ink bg-ink text-page"
                    : "border-line-strong text-ink-2 hover:border-ink/40"
                }`}
              >
                {label === "custom" ? (
                  <>
                    <Clock size={13} /> Custom
                  </>
                ) : (
                  label
                )}
              </button>
            ))}
          </div>
          {choice === "custom" ? (
            <label className="mt-3 flex max-w-[220px] items-center gap-2 rounded-xl border border-line-strong bg-surface px-3 py-2 focus-within:border-ink">
              <input
                type="number"
                min={0.25}
                max={72}
                step={0.25}
                value={customHours}
                onChange={(event) => setCustomHours(event.target.value)}
                placeholder="e.g. 3"
                className="w-full bg-transparent text-[14px] outline-none"
              />
              <span className="text-[13px] text-muted">hours</span>
            </label>
          ) : null}

          <label className="mt-5 block max-w-2xl">
            <span className="text-[12.5px] font-semibold text-ink-2">Message (optional)</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={280}
              rows={2}
              placeholder="e.g. We’re importing this week’s belt test results."
              className="mt-1.5 w-full resize-y rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-[14px] leading-6 outline-none placeholder:text-faint focus:border-ink"
            />
          </label>

          <AnimatePresence>
            {error ? (
              <div className="mt-4 max-w-2xl">
                <FormBanner tone="error">{error}</FormBanner>
              </div>
            ) : null}
          </AnimatePresence>

          <button
            type="button"
            disabled={pending}
            onClick={() => void save(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#f59e0b] to-[#d97706] px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(217,119,6,0.7)] transition hover:opacity-90 disabled:opacity-50"
          >
            <Wrench size={15} />
            {pending ? "Saving…" : state.enabled ? "Update maintenance" : "Turn on maintenance"}
          </button>
        </section>
      </Frame>
    </Page>
  );
}
