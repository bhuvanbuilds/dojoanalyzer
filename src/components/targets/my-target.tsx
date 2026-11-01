"use client";

import { useEffect, useState } from "react";
import { Target } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { setTargetPopupState, whenWhatsNewDone } from "@/lib/whats-new-gate";
import { LANGUAGE_COLORS } from "@/components/dashboard/chart-kit";
import {
  TARGET_LANGUAGE_LABELS,
  daysLeft,
  describeTarget,
  monthLabel,
  type BeltTarget,
  type TargetProgress,
} from "@/lib/belt-targets";

type Mine = { target: BeltTarget | null; progress?: TargetProgress; month?: string };

// One request per page load, shared by the card and the popup.
let pending: Promise<Mine> | null = null;
function loadMine() {
  pending ??= fetch("/api/targets/mine", { cache: "no-store" })
    .then((response) => (response.ok ? (response.json() as Promise<Mine>) : { target: null }))
    .catch(() => ({ target: null }));
  return pending;
}

function useMine(enabled: boolean) {
  const [mine, setMine] = useState<Mine | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    loadMine().then((result) => active && setMine(result));
    return () => {
      active = false;
    };
  }, [enabled]);
  return mine;
}

function Progress({ mine }: { mine: Required<Pick<Mine, "progress" | "month">> & Mine }) {
  const { progress } = mine;
  const pct = progress.goal ? Math.min(100, (progress.gained / progress.goal) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums">
          {progress.gained}
          <span className="text-[16px] font-medium text-faint"> / {progress.goal} belts</span>
        </p>
        <p className={`text-[12.5px] ${progress.done ? "font-medium text-success-text" : "text-muted"}`}>
          {progress.done ? "Target reached 🎉" : `${daysLeft(mine.month)} days left`}
        </p>
      </div>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-sunken">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${progress.done ? "bg-success-text" : "bg-action"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {progress.languages.length ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {progress.languages.map((item) => (
            <li key={item.language} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-0.5 text-[12.5px] text-ink-2">
              <span className="size-2 rounded-full" style={{ background: LANGUAGE_COLORS[item.language] }} aria-hidden="true" />
              {TARGET_LANGUAGE_LABELS[item.language]}
              <span className="font-semibold tabular-nums text-ink">
                {item.gained}/{item.goal}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** "This month's target" card on a student's own profile. */
export function MyTargetCard() {
  const mine = useMine(true);
  if (!mine?.target || !mine.progress || !mine.month) return null;
  return (
    <section data-tour="my-target" className="noise-card px-4 py-4 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold">
          <Target size={16} className="text-brand" />
          Your target for {monthLabel(mine.month)}: {describeTarget(mine.target)}
        </h2>
        {mine.target.set_by_name ? <span className="text-[12px] text-muted">Set by {mine.target.set_by_name}</span> : null}
      </div>
      <Progress mine={mine as Required<Pick<Mine, "progress" | "month">> & Mine} />
      {mine.target.note ? <p className="mt-3 text-[13px] italic text-ink-2">“{mine.target.note}”</p> : null}
    </section>
  );
}

/** One-time popup the first time a student opens the app after a target is set. */
export function TargetPopup() {
  const [isStudent, setIsStudent] = useState(false);
  const mine = useMine(isStudent);
  const [closed, setClosed] = useState(false);
  // Wait for What's new to be closed before showing this.
  const [ready, setReady] = useState(false);
  const wanted = Boolean(isStudent && mine?.target && !mine.target.seen_at && mine.progress && mine.month);

  useEffect(() => {
    let active = true;
    getCurrentUserProfile()
      .then((result) => {
        if (!active) return;
        const student = result.status === "authenticated" && result.profile.role === "student";
        if (student) setIsStudent(true);
        else setTargetPopupState("done");
      })
      .catch(() => setTargetPopupState("done"));
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!mine) return;
    if (!wanted) {
      setTargetPopupState("done");
      return;
    }
    setTargetPopupState("open");
    let active = true;
    whenWhatsNewDone().then(() => active && setReady(true));
    return () => {
      active = false;
    };
  }, [mine, wanted]);

  const open = wanted && ready && !closed;

  function close() {
    setClosed(true);
    setTargetPopupState("done");
    void fetch("/api/targets/mine", { method: "POST" }).catch(() => undefined);
  }

  if (!open || !mine?.target || !mine.progress || !mine.month) return null;
  return (
    <Dialog
      open
      onClose={close}
      eyebrow="New belt target"
      title={`${describeTarget(mine.target)} in ${monthLabel(mine.month)}`}
      description={mine.target.set_by_name ? `${mine.target.set_by_name} set this target for you.` : "Your mentor set this target for you."}
      footer={
        <button
          type="button"
          onClick={close}
          className="rounded-lg bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-page transition hover:opacity-90"
        >
          Let’s do it
        </button>
      }
    >
      <div className="px-6 pb-5">
        <Progress mine={mine as Required<Pick<Mine, "progress" | "month">> & Mine} />
        {mine.target.note ? <p className="mt-3 text-[13px] italic text-ink-2">“{mine.target.note}”</p> : null}
        <p className="mt-3 text-[12.5px] text-muted">Progress updates after every weekly belt test. You can always see it on My profile.</p>
      </div>
    </Dialog>
  );
}
