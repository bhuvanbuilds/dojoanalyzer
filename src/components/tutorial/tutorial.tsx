"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Compass,
  FileSpreadsheet,
  Lock,
  MousePointerClick,
  X,
} from "lucide-react";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { Dialog } from "@/components/ui/dialog";
import {
  CHECKLISTS,
  CSV_DEMO_SAMPLE,
  CSV_DEMO_STAGES,
  PAGE_HINTS,
  PAGE_LABELS,
  ROLE_LABELS,
  TOUR_IDS,
  TOURS,
  firstStepOn,
  nextPageIndex,
  pageMatches,
  tutorialRoleFor,
  type TutorialRole,
  type TutorialStep,
} from "@/lib/tutorial/config";

/** Window events other components fire to drive the tutorial. */
export const TUTORIAL_START_EVENT = "dojo:tutorial-start";
export const TUTORIAL_HELP_EVENT = "dojo:tutorial-help";
export type TutorialStartDetail = { fromPage?: boolean };

const FIND_TIMEOUT = 3000;
const NO_STEPS: TutorialStep[] = [];
const snoozeKey = (tour: string) => `dojo:tutorial-snooze:${tour}`;
const checklistKey = (role: TutorialRole) => `dojo:tutorial-checklist:${role}`;

function storage(kind: "local" | "session") {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function findTarget(targets: string[]) {
  for (const name of targets) {
    const selector = name.startsWith("css:") ? name.slice(4) : `[data-tour="${name}"]`;
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      const box = element.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) return element;
    }
  }
  return null;
}

/** Keys typed into a field, or handled by a widget, aren't tutorial shortcuts. */
function ownsKeys(element: Element | null) {
  if (!element) return false;
  if (element.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']")) return true;
  return Boolean(element.closest("[role=tablist], [role=radiogroup], [role=listbox], [role=menu], [aria-roledescription=carousel]"));
}

function readChecklist(role: TutorialRole): string[] {
  try {
    return JSON.parse(storage("local")?.getItem(checklistKey(role)) ?? "[]") as string[];
  } catch {
    return [];
  }
}

type Status = "searching" | "ready" | "elsewhere";

/**
 * Role-aware guided tutorial: a first-visit intro, a spotlight tour that the
 * person steps through on the real pages, Help-centre guides, a checklist and
 * a CSV upload demo that never touches the import API.
 */
export function Tutorial() {
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [role, setRole] = useState<TutorialRole | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [intro, setIntro] = useState(false);
  const [help, setHelp] = useState(false);
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<Status>("searching");
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [demo, setDemo] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const direction = useRef<1 | -1>(1);
  const cardRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const steps = role ? TOURS[role] : NO_STEPS;
  const step: TutorialStep | undefined = running ? steps[index] : undefined;
  const tourId = role ? TOUR_IDS[role] : null;

  // ── Who is this, and have they seen it? ──────────────────────────────────
  useEffect(() => {
    let active = true;
    getCurrentUserProfile()
      .then(async (result) => {
        if (!active || result.status !== "authenticated") return;
        const tour = tutorialRoleFor(result.profile);
        if (!tour) return;
        const viewing = Boolean(result.profile.viewing_as);
        setRole(tour);
        setPreviewing(viewing);
        setChecked(readChecklist(tour));
        // View as never auto-starts; developers launch it from the banner.
        if (viewing) return;
        if (storage("session")?.getItem(snoozeKey(TOUR_IDS[tour]))) return;
        const response = await fetch("/api/tutorial", { cache: "no-store" });
        if (!response.ok) return; // Unknown state: don't risk nagging.
        const body = (await response.json()) as { completed?: string[] };
        if (active && !(body.completed ?? []).includes(TOUR_IDS[tour])) setIntro(true);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  // Checklist: visiting a page ticks its item. Separate from tour completion.
  useEffect(() => {
    if (!role) return;
    const item = CHECKLISTS[role].find((entry) => pageMatches(entry.href, pathname));
    if (!item) return;
    const done = readChecklist(role);
    if (done.includes(item.id)) return;
    storage("local")?.setItem(checklistKey(role), JSON.stringify([...done, item.id]));
  }, [role, pathname]);

  const record = useCallback(
    (outcome: "completed" | "skipped") => {
      if (!tourId || previewing) return;
      void fetch("/api/tutorial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tour: tourId, outcome }),
      }).catch(() => undefined);
    },
    [tourId, previewing],
  );

  const goTo = useCallback((next: number, dir: 1 | -1) => {
    direction.current = dir;
    setRect(null);
    setStatus("searching");
    setIndex(next);
  }, []);

  const start = useCallback(
    (fromPage = false) => {
      if (!role) return;
      returnFocus.current = document.activeElement as HTMLElement | null;
      const from = fromPage ? Math.max(0, firstStepOn(TOURS[role], window.location.pathname)) : 0;
      setIntro(false);
      setHelp(false);
      setRunning(true);
      goTo(from, 1);
    },
    [role, goTo],
  );

  const close = useCallback(() => {
    setRunning(false);
    setDemo(false);
    setRect(null);
    returnFocus.current?.focus?.();
  }, []);

  const finish = useCallback(() => {
    record("completed");
    close();
  }, [record, close]);

  const skipTour = useCallback(() => {
    record("skipped");
    setIntro(false);
    close();
  }, [record, close]);

  const remindLater = useCallback(() => {
    if (tourId) storage("session")?.setItem(snoozeKey(tourId), "1");
    setIntro(false);
    close();
  }, [tourId, close]);

  const next = useCallback(() => {
    if (index >= steps.length - 1) finish();
    else goTo(index + 1, 1);
  }, [index, steps.length, finish, goTo]);

  const back = useCallback(() => {
    if (index > 0) goTo(index - 1, -1);
  }, [index, goTo]);

  const skipPage = useCallback(() => {
    const target = nextPageIndex(steps, index);
    if (target >= steps.length) finish();
    else goTo(target, 1);
  }, [steps, index, finish, goTo]);

  // External triggers: Help menu, View as banner.
  useEffect(() => {
    const onStart = (event: Event) => start((event as CustomEvent<TutorialStartDetail>).detail?.fromPage);
    const onHelp = () => setHelp(true);
    window.addEventListener(TUTORIAL_START_EVENT, onStart);
    window.addEventListener(TUTORIAL_HELP_EVENT, onHelp);
    return () => {
      window.removeEventListener(TUTORIAL_START_EVENT, onStart);
      window.removeEventListener(TUTORIAL_HELP_EVENT, onHelp);
    };
  }, [start]);

  // ── Follow the current step: right page? element there? keep it framed. ──
  useEffect(() => {
    if (!step) return;
    let foundAt = 0;
    let waitingSince = Date.now();
    let scrolled = false;
    const tick = () => {
      if (!pageMatches(step.page, window.location.pathname)) {
        waitingSince = Date.now();
        setStatus("elsewhere");
        setRect(null);
        return;
      }
      const element = findTarget(step.target);
      if (!element) {
        foundAt = 0;
        // Not on screen for this role or state: move on in the same direction.
        if (Date.now() - waitingSince > FIND_TIMEOUT) {
          if (direction.current === 1) next();
          else if (index > 0) back();
          else next();
        } else setStatus("searching");
        return;
      }
      if (!foundAt) foundAt = Date.now();
      if (!scrolled) {
        scrolled = true;
        const box = element.getBoundingClientRect();
        if (box.top < 90 || box.bottom > window.innerHeight - 40) {
          const tall = box.height > window.innerHeight * 0.5;
          const top = tall ? box.top + window.scrollY - 110 : box.top + window.scrollY - (window.innerHeight - box.height) / 2;
          window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
        }
      }
      setStatus("ready");
      const box = element.getBoundingClientRect();
      setRect((current) =>
        current &&
        Math.abs(current.top - box.top) < 0.5 &&
        Math.abs(current.left - box.left) < 0.5 &&
        Math.abs(current.width - box.width) < 0.5 &&
        Math.abs(current.height - box.height) < 0.5
          ? current
          : box,
      );
    };
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 150);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [step, pathname, index, next, back, reduce]);

  // Move focus to the card on each step so screen readers follow along.
  useEffect(() => {
    if (step && !demo) cardRef.current?.focus({ preventScroll: true });
  }, [step, demo]);

  useEffect(() => {
    if (!running || demo) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || ownsKeys(document.activeElement === cardRef.current ? null : document.activeElement))
        return;
      if (event.key === "Escape") remindLater();
      else if (event.key === "ArrowRight" && step?.action !== "csv-demo" && status !== "elsewhere") next();
      else if (event.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, demo, step, status, next, back, remindLater]);

  if (typeof document === "undefined" || !role) return null;

  return (
    <>
      {intro ? (
        <IntroCard role={role} onStart={() => start(false)} onLater={remindLater} onSkip={skipTour} />
      ) : null}
      <HelpPanel
        open={help}
        role={role}
        pathname={pathname}
        checked={checked}
        onClose={() => setHelp(false)}
        onStart={start}
        onOpenHelp={() => setChecked(readChecklist(role))}
      />
      {step ? (
        <Spotlight
          step={step}
          index={index}
          total={steps.length}
          status={status}
          rect={demo ? null : rect}
          cardRef={cardRef}
          reduce={Boolean(reduce)}
          onBack={back}
          onNext={next}
          onGo={() => router.push(step.page)}
          onDemo={() => setDemo(true)}
          onSkipPage={skipPage}
          onSkipTour={skipTour}
          onLater={remindLater}
          hidden={demo}
        />
      ) : null}
      {demo ? (
        <CsvDemo
          onClose={() => {
            setDemo(false);
            next();
          }}
        />
      ) : null}
    </>
  );
}

// ─── Spotlight + step card ─────────────────────────────────────────────────────
function Spotlight({
  step,
  index,
  total,
  status,
  rect,
  cardRef,
  reduce,
  hidden,
  onBack,
  onNext,
  onGo,
  onDemo,
  onSkipPage,
  onSkipTour,
  onLater,
}: {
  step: TutorialStep;
  index: number;
  total: number;
  status: Status;
  rect: DOMRect | null;
  cardRef: React.RefObject<HTMLDivElement | null>;
  reduce: boolean;
  hidden: boolean;
  onBack: () => void;
  onNext: () => void;
  onGo: () => void;
  onDemo: () => void;
  onSkipPage: () => void;
  onSkipTour: () => void;
  onLater: () => void;
}) {
  if (hidden) return null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 6;
  const hole = rect
    ? {
        left: Math.max(4, rect.left - pad),
        top: Math.max(4, rect.top - pad),
        right: Math.min(vw - 4, rect.right + pad),
        bottom: Math.min(vh - 4, rect.bottom + pad),
      }
    : null;
  const mobile = vw < 640;
  const width = 384;
  let place: CSSProperties = { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width };
  if (mobile) place = { left: 12, right: 12, bottom: "calc(12px + env(safe-area-inset-bottom))" };
  else if (hole) {
    const left = Math.min(Math.max(12, (hole.left + hole.right) / 2 - width / 2), vw - width - 12);
    if (vh - hole.bottom > 280) place = { left, top: hole.bottom + 12, width };
    else if (hole.top > 280) place = { left, bottom: vh - hole.top + 12, width };
    else place = { right: 16, bottom: 16, width };
  }

  const elsewhere = status === "elsewhere";
  const pageLabel = PAGE_LABELS[step.page] ?? step.page;
  const hint = PAGE_HINTS[step.page];
  const guarded = step.action === "guarded";

  let primary: { label: string; onClick?: () => void; icon?: boolean } = { label: index === total - 1 ? "Finish" : "Next", onClick: onNext, icon: true };
  if (elsewhere) primary = hint ? { label: "Waiting…" } : { label: `Go to ${pageLabel}`, onClick: onGo, icon: true };
  else if (step.action === "csv-demo") primary = { label: "Open the demo", onClick: onDemo, icon: true };
  else if (step.action === "click") primary = { label: index === total - 1 ? "Finish" : "Continue", onClick: onNext, icon: true };

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[300]">
      {/* Dimmed page with a cut-out; never blocks clicks on the page itself. */}
      {hole ? (
        <div
          aria-hidden="true"
          className="fixed rounded-xl transition-all duration-300 ease-out motion-reduce:transition-none"
          style={{
            left: hole.left,
            top: hole.top,
            width: hole.right - hole.left,
            height: hole.bottom - hole.top,
            boxShadow: "0 0 0 9999px color-mix(in srgb, #0a0a0c 48%, transparent)",
            outline: "2px solid var(--ink)",
            outlineOffset: 0,
          }}
        />
      ) : (
        <div aria-hidden="true" className="fixed inset-0 bg-[color-mix(in_srgb,#0a0a0c_40%,transparent)]" />
      )}
      {/* Consequential controls are paused while their step is showing. */}
      {hole && guarded ? (
        <div
          className="pointer-events-auto fixed cursor-not-allowed"
          style={{ left: hole.left, top: hole.top, width: hole.right - hole.left, height: hole.bottom - hole.top }}
          onClickCapture={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onPointerDownCapture={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          title="Paused during the tutorial"
        />
      ) : null}

      <motion.div
        key={step.id}
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tutorial-title"
        aria-describedby="tutorial-body"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        style={{ position: "fixed", ...place }}
        className="pointer-events-auto max-w-[calc(100vw-24px)] rounded-2xl border border-line bg-surface p-4 text-ink shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] outline-none focus-visible:ring-2 focus-visible:ring-ink/30 sm:p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
            Step {index + 1} of {total} · {step.page === "*" ? "Anywhere" : pageLabel}
          </p>
          <button
            type="button"
            onClick={onLater}
            aria-label="Close tutorial (remind me later)"
            className="-m-1 rounded-lg p-1 text-muted transition hover:bg-sunken hover:text-ink"
          >
            <X size={15} />
          </button>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
          <div className="h-full rounded-full bg-ink transition-all duration-300" style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>

        {guarded || step.action === "csv-demo" ? (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-sunken px-2 py-1 text-[11.5px] font-semibold text-ink-2">
            <Lock size={11} /> {guarded ? "Explained only: this control is paused" : "Demo: nothing is uploaded"}
          </p>
        ) : step.action === "click" && !elsewhere ? (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-sunken px-2 py-1 text-[11.5px] font-semibold text-ink-2">
            <MousePointerClick size={11} /> Try it on the highlighted control
          </p>
        ) : null}

        <h2 id="tutorial-title" className="mt-2.5 font-display text-[17px] font-bold leading-snug tracking-[-0.02em]">
          {step.title}
        </h2>
        <p id="tutorial-body" aria-live="polite" className="mt-1.5 text-[14px] leading-6 text-ink-2">
          {elsewhere
            ? (hint ?? `This step is on the ${pageLabel} page. Open it when you're ready.`)
            : status === "searching"
              ? "Finding this part of the page…"
              : step.body}
        </p>
        {step.media && !elsewhere ? (
          step.media.kind === "video" ? (
            <video src={step.media.src} aria-label={step.media.alt} muted loop playsInline autoPlay={!reduce} className="mt-3 w-full rounded-lg border border-line" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={step.media.src} alt={step.media.alt} className="mt-3 w-full rounded-lg border border-line" />
          )
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            disabled={index === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-line-strong px-3 py-1.5 text-[13px] font-semibold text-ink-2 transition hover:border-ink/40 hover:text-ink disabled:opacity-40"
          >
            <ArrowLeft size={13} /> Back
          </button>
          <button
            type="button"
            onClick={primary.onClick}
            disabled={!primary.onClick}
            className="inline-flex items-center gap-1 rounded-lg bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-page transition hover:opacity-90 disabled:opacity-60"
          >
            {primary.label} {primary.icon ? <ArrowRight size={13} /> : null}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2.5 text-[12px] font-semibold text-muted">
          <button type="button" onClick={onSkipPage} className="transition hover:text-ink">
            Skip this page
          </button>
          <button type="button" onClick={onSkipTour} className="transition hover:text-ink">
            Skip tour
          </button>
          <button type="button" onClick={onLater} className="ml-auto transition hover:text-ink">
            Remind me later
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

// ─── First-visit intro ─────────────────────────────────────────────────────────
function IntroCard({
  role,
  onStart,
  onLater,
  onSkip,
}: {
  role: TutorialRole;
  onStart: () => void;
  onLater: () => void;
  onSkip: () => void;
}) {
  const reduce = useReducedMotion();
  const steps = TOURS[role].length;
  const pages = new Set(TOURS[role].map((step) => step.page).filter((page) => page !== "*")).size;
  return createPortal(
    <div className="fixed inset-0 z-[300] grid place-items-end p-3 sm:place-items-center">
      <div aria-hidden="true" className="fixed inset-0 bg-[color-mix(in_srgb,#0a0a0c_45%,transparent)]" />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-intro-title"
        initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className="relative w-full max-w-md rounded-2xl border border-line bg-surface p-5 text-ink shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)]"
      >
        <motion.span
          aria-hidden="true"
          initial={reduce ? false : { rotate: -30, scale: 0.6, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 220, damping: 16 }}
          className="grid h-11 w-11 place-items-center rounded-xl bg-sunken text-ink"
        >
          <Compass size={22} />
        </motion.span>
        <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{ROLE_LABELS[role]} tutorial</p>
        <h2 id="tutorial-intro-title" className="mt-1 font-display text-[21px] font-bold leading-tight tracking-[-0.025em]">
          Want a guided walkthrough?
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-ink-2">
          {steps} short steps across {pages} {pages === 1 ? "page" : "pages"}. You click through the real app yourself, and nothing is changed for you. You can skip a page or stop at any time, and replay it later from Help.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={onSkip} className="rounded-lg py-1.5 text-[13px] font-semibold text-muted transition hover:text-ink">
            Skip tour
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onLater}
              className="rounded-lg border border-line-strong px-3 py-1.5 text-[13px] font-semibold text-ink-2 transition hover:border-ink/40 hover:text-ink"
            >
              Remind me later
            </button>
            <button
              type="button"
              autoFocus
              onClick={onStart}
              className="inline-flex items-center gap-1 rounded-lg bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-page transition hover:opacity-90"
            >
              Start tour <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

// ─── Help centre ───────────────────────────────────────────────────────────────
function HelpPanel({
  open,
  role,
  pathname,
  checked,
  onClose,
  onStart,
  onOpenHelp,
}: {
  open: boolean;
  role: TutorialRole;
  pathname: string;
  checked: string[];
  onClose: () => void;
  onStart: (fromPage?: boolean) => void;
  onOpenHelp: () => void;
}) {
  const steps = TOURS[role];
  const hasPage = firstStepOn(steps, pathname) >= 0;
  const groups: Array<{ page: string; steps: TutorialStep[] }> = [];
  for (const step of steps) {
    const last = groups.at(-1);
    if (last && last.page === step.page) last.steps.push(step);
    else groups.push({ page: step.page, steps: [step] });
  }
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    if (open) onOpenHelp();
  }, [open, onOpenHelp]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      eyebrow="Help"
      title="Tutorials and guides"
      description={`Everything here is for the ${ROLE_LABELS[role].toLowerCase()} view.`}
    >
      <div className="flex flex-col gap-6 px-6 pb-6">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onStart(false)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-2 text-[13px] font-semibold text-page transition hover:opacity-90"
          >
            <Compass size={14} /> Replay full tour
          </button>
          {hasPage ? (
            <button
              type="button"
              onClick={() => onStart(true)}
              className="rounded-lg border border-line-strong px-3.5 py-2 text-[13px] font-semibold text-ink-2 transition hover:border-ink/40 hover:text-ink"
            >
              This page&apos;s tutorial
            </button>
          ) : null}
        </div>

        <section>
          <h3 className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted">Get to know the app (optional)</h3>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
            {CHECKLISTS[role].map((item) => {
              const done = checked.includes(item.id);
              return (
                <li key={item.id}>
                  <Link href={item.href} onClick={onClose} className="flex items-center gap-3 px-3.5 py-2.5 text-[13.5px] transition hover:bg-sunken">
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${done ? "border-ink bg-ink text-page" : "border-line-strong"}`}
                    >
                      {done ? <Check size={12} strokeWidth={3} /> : null}
                    </span>
                    <span className={done ? "text-muted line-through" : "font-medium"}>{item.label}</span>
                    <span className="sr-only">{done ? "(done)" : "(not yet)"}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h3 className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted">Guides by page</h3>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
            {groups.map((group) => {
              const key = `${group.page}:${group.steps[0].id}`;
              const expanded = openGroup === key;
              return (
                <li key={key}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setOpenGroup(expanded ? null : key)}
                    className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-[13.5px] font-semibold transition hover:bg-sunken"
                  >
                    {group.page === "*" ? "Everywhere" : (PAGE_LABELS[group.page] ?? group.page)}
                    <ChevronDown size={15} className={`text-muted transition ${expanded ? "rotate-180" : ""}`} />
                  </button>
                  {expanded ? (
                    <dl className="space-y-3 px-3.5 pb-3.5">
                      {group.steps.map((step) => (
                        <div key={step.id}>
                          <dt className="text-[13px] font-semibold">{step.title}</dt>
                          <dd className="mt-0.5 text-[13px] leading-5 text-muted">{step.body}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </Dialog>
  );
}

// ─── CSV upload demo (synthetic data, no network) ──────────────────────────────
function CsvDemo({ onClose }: { onClose: () => void }) {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState(0);
  const [file, setFile] = useState(false);
  const [importing, setImporting] = useState(false);
  const current = CSV_DEMO_STAGES[stage];
  const sample = CSV_DEMO_SAMPLE;
  const last = stage === CSV_DEMO_STAGES.length - 1;
  const needsFile = current.id === "CM21" && !file;
  const needsImport = current.id === "CM25";

  useEffect(() => {
    if (!importing) return;
    const timer = window.setTimeout(() => {
      setImporting(false);
      setStage((value) => value + 1);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [importing]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const show = (...ids: string[]) => ids.includes(current.id);
  const newCount = sample.students.filter((student) => student.status === "new").length;

  return createPortal(
    <div className="fixed inset-0 z-[310] grid place-items-end p-3 sm:place-items-center">
      <div aria-hidden="true" className="fixed inset-0 bg-[color-mix(in_srgb,#0a0a0c_50%,transparent)]" />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="csv-demo-title"
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative max-h-[calc(100dvh-24px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface text-ink shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-[#f59e0b] px-1.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-[#1c1917]">
              Demo
            </span>
            <span className="text-[13px] font-semibold">Upload CSV walkthrough</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close demo" className="-m-1 rounded-lg p-1 text-muted hover:bg-sunken hover:text-ink">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
            Part {stage + 1} of {CSV_DEMO_STAGES.length}
          </p>
          <h2 id="csv-demo-title" className="mt-1 font-display text-[17px] font-bold tracking-[-0.02em]">
            {current.title}
          </h2>
          <p aria-live="polite" className="mt-1 text-[13.5px] leading-6 text-ink-2">
            {current.body}
          </p>

          {/* The mock dialog. Every value below is made up. */}
          <div className="mt-4 space-y-3 rounded-xl border border-dashed border-line-strong bg-surface-2 p-3.5 text-[13px]">
            <div className={`rounded-lg border bg-surface px-3 py-2 ${show("CM20") ? "border-ink" : "border-line"}`}>
              <p className="text-[11px] font-semibold text-muted">University</p>
              <p className="font-semibold">Your campus (fixed)</p>
            </div>
            <button
              type="button"
              disabled={current.id !== "CM21"}
              onClick={() => setFile(true)}
              className={`flex w-full items-center gap-2.5 rounded-lg border bg-surface px-3 py-2 text-left ${show("CM21") ? "border-ink" : "border-line"}`}
            >
              <FileSpreadsheet size={16} className="text-[#059669]" />
              <span className="font-semibold">{file ? sample.fileName : "Choose the sample file"}</span>
              {file ? <Check size={14} className="ml-auto text-[#059669]" /> : null}
            </button>
            {stage >= 2 ? (
              <div className={`grid grid-cols-3 gap-2 ${show("CM22") ? "rounded-lg ring-2 ring-ink" : ""}`}>
                {[
                  ["Academic year", sample.academicYear],
                  ["Weeks", sample.weeks.join(", ")],
                  ["Records", String(sample.records)],
                  ["Unique students", String(sample.students.length)],
                  ["New students", String(newCount)],
                  ["Memberships to add", String(newCount)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-line bg-surface px-2.5 py-2">
                    <p className="text-[10.5px] text-muted">{label}</p>
                    <p className="font-display text-[15px] font-bold">{value}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {stage >= 3 ? (
              <div className={`rounded-lg border bg-surface px-3 py-2 ${show("CM23") ? "border-ink" : "border-line"}`}>
                <p className="text-[11px] font-semibold text-muted">Validation errors</p>
                {sample.errors.map((error) => (
                  <p key={error.row} className="text-[12.5px]">
                    Row {error.row}: {error.problem}
                  </p>
                ))}
              </div>
            ) : null}
            {stage >= 4 ? (
              <ul className={`divide-y divide-line rounded-lg border bg-surface ${show("CM24") ? "border-ink" : "border-line"}`}>
                {sample.students.map((student) => (
                  <li key={student.name} className="flex items-center justify-between px-3 py-1.5 text-[12.5px]">
                    <span>
                      {student.name} · Squad {student.squad}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${student.status === "new" ? "bg-[color-mix(in_srgb,#10b981_16%,transparent)]" : "bg-sunken text-muted"}`}>
                      {student.status === "new" ? "New" : "Existing"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {stage >= 6 ? (
              <div className={`grid grid-cols-2 gap-2 rounded-lg ${show("CM26") ? "ring-2 ring-ink" : ""}`}>
                {[
                  ["Students created", sample.result.studentsCreated],
                  ["Memberships created", sample.result.membershipsCreated],
                  ["Already assigned", sample.result.alreadyAssigned],
                  ["Errors", sample.result.errors],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-line bg-surface px-2.5 py-2">
                    <p className="text-[10.5px] text-muted">{label} (example)</p>
                    <p className="font-display text-[15px] font-bold">{value}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {stage >= 7 ? (
              <p className={`inline-flex rounded-lg border bg-surface px-3 py-1.5 text-[12.5px] font-semibold ${show("CM27") ? "border-ink" : "border-line"}`}>
                Manage squads →
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
          <button
            type="button"
            onClick={() => setStage((value) => Math.max(0, value - 1))}
            disabled={stage === 0 || importing}
            className="inline-flex items-center gap-1 rounded-lg border border-line-strong px-3 py-1.5 text-[13px] font-semibold text-ink-2 disabled:opacity-40"
          >
            <ArrowLeft size={13} /> Back
          </button>
          <button
            type="button"
            disabled={needsFile || importing}
            onClick={() => (last ? onClose() : needsImport ? setImporting(true) : setStage((value) => value + 1))}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-page transition hover:opacity-90 disabled:opacity-50"
          >
            {importing ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> Importing (demo)…
              </>
            ) : last ? (
              "Close demo"
            ) : needsImport ? (
              "Import (demo)"
            ) : needsFile ? (
              "Choose the sample file first"
            ) : (
              <>
                Next <ArrowRight size={13} />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

/** Help-menu helper: open the Help centre. */
export function openTutorialHelp() {
  window.dispatchEvent(new Event(TUTORIAL_HELP_EVENT));
}

/** View-as helper: start the viewed role's tour. */
export function startTutorial(detail: TutorialStartDetail = {}) {
  window.dispatchEvent(new CustomEvent<TutorialStartDetail>(TUTORIAL_START_EVENT, { detail }));
}

