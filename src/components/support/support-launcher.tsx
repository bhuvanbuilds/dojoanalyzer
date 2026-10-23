"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronRight, Compass, Headset, Sparkles, Ticket, X } from "lucide-react";
import { useCachedProfile } from "@/lib/auth/use-cached-profile";
import { tutorialRoleFor } from "@/lib/tutorial/config";
import { openTutorialHelp } from "@/components/tutorial/tutorial";
import { TYPE_LABELS, type TicketType } from "@/lib/support";
import { NewTicketDialog, TYPE_META } from "@/components/support/kit";

const ACTIONS: Array<{ type: TicketType; label: string; hint: string }> = [
  { type: "feature", label: "Suggest a feature", hint: TYPE_META.feature.blurb },
  { type: "bug", label: "Report a bug", hint: TYPE_META.bug.blurb },
  { type: "other", label: "Report another issue", hint: TYPE_META.other.blurb },
];

/** Floating help button: opens a small menu for new tickets and My tickets. */
export function SupportLauncher() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogType, setDialogType] = useState<TicketType | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const cached = useCachedProfile();
  // Developers have no tutorial of their own (only while using View as).
  const hasTutorial = cached?.status === "authenticated" && tutorialRoleFor(cached.profile) !== null;

  useEffect(() => {
    if (!menuOpen) return;
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [menuOpen]);

  return (
    <>
      <div ref={rootRef} className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3 print:hidden">
        <AnimatePresence>
          {menuOpen ? (
            <motion.div
              id="support-menu"
              role="menu"
              aria-label="Kalvium support"
              initial={reduced ? false : { opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? undefined : { opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="w-[min(320px,calc(100vw-40px))] origin-bottom-right overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45),0_4px_14px_rgba(0,0,0,0.08)]"
            >
              <div className="relative overflow-hidden border-b border-line px-4 pb-3.5 pt-4">
                <div
                  aria-hidden="true"
                  className="absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-60 blur-2xl"
                  style={{ background: "radial-gradient(circle, rgba(239,56,55,0.35), transparent 70%)" }}
                />
                <p className="relative font-display text-[15px] font-bold tracking-[-0.02em]">
                  Kalvium Support
                </p>
                <p className="relative mt-0.5 text-[12.5px] text-muted">
                  Ideas, bugs or questions — we read every one.
                </p>
              </div>
              <div className="p-1.5">
                {ACTIONS.map((action) => {
                  const meta = TYPE_META[action.type];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={action.type}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        setDialogType(action.type);
                      }}
                      className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-none"
                    >
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl transition group-hover:scale-105"
                        style={{ background: meta.soft, color: meta.tint }}
                      >
                        <Icon size={17} strokeWidth={2.2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-semibold text-ink">{action.label}</span>
                        <span className="block truncate text-[12px] text-muted">{action.hint}</span>
                      </span>
                      <ChevronRight
                        size={15}
                        className="text-faint transition group-hover:translate-x-0.5 group-hover:text-ink"
                      />
                    </button>
                  );
                })}
                <div className="mx-2.5 my-1 h-px bg-line" />
                {hasTutorial ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      openTutorialHelp();
                    }}
                    className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-none"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sunken text-ink-2">
                      <Compass size={17} strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-semibold text-ink">Tutorials and guides</span>
                      <span className="block text-[12px] text-muted">Replay the tour or read a page guide</span>
                    </span>
                    <ChevronRight
                      size={15}
                      className="text-faint transition group-hover:translate-x-0.5 group-hover:text-ink"
                    />
                  </button>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/support");
                  }}
                  className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-none"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sunken text-ink-2">
                    <Ticket size={17} strokeWidth={2.2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold text-ink">My tickets</span>
                    <span className="block text-[12px] text-muted">Follow replies and past reports</span>
                  </span>
                  <ChevronRight
                    size={15}
                    className="text-faint transition group-hover:translate-x-0.5 group-hover:text-ink"
                  />
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/changelog");
                  }}
                  className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-none"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sunken text-ink-2">
                    <Sparkles size={17} strokeWidth={2.2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold text-ink">What’s new</span>
                    <span className="block text-[12px] text-muted">Latest fixes and features</span>
                  </span>
                  <ChevronRight
                    size={15}
                    className="text-faint transition group-hover:translate-x-0.5 group-hover:text-ink"
                  />
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <button
          type="button"
          aria-label={menuOpen ? "Close support menu" : "Help and feedback"}
          data-tour="help"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? "support-menu" : undefined}
          onClick={() => setMenuOpen((open) => !open)}
          className={`group relative flex h-12 items-center overflow-hidden rounded-full pl-[13px] pr-[13px] text-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action active:scale-95 ${
            menuOpen
              ? "bg-[#18181b] shadow-[0_12px_30px_-10px_rgba(0,0,0,0.55)] dark:bg-[#f4f4f5] dark:text-[#18181b]"
              : "bg-gradient-to-br from-[#ff5a52] to-[#d32f2e] shadow-[0_14px_32px_-10px_rgba(211,47,46,0.65),inset_0_1px_0_rgba(255,255,255,0.25)] hover:-translate-y-0.5 hover:pr-5 hover:shadow-[0_18px_40px_-12px_rgba(211,47,46,0.75),inset_0_1px_0_rgba(255,255,255,0.25)]"
          }`}
        >
          {/* Soft halo that breathes while closed. */}
          {!menuOpen && !reduced ? (
            <span
              aria-hidden="true"
              className="dojo-anim pointer-events-none absolute inset-0 animate-ping rounded-full bg-[#ef3837] opacity-20 [animation-duration:2.6s]"
            />
          ) : null}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={menuOpen ? "close" : "help"}
              initial={reduced ? false : { rotate: -90, opacity: 0, scale: 0.6 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={reduced ? undefined : { rotate: 90, opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.18 }}
              className="relative grid h-[22px] w-[22px] shrink-0 place-items-center"
            >
              {menuOpen ? <X size={20} strokeWidth={2.4} /> : <Headset size={21} strokeWidth={2.2} />}
            </motion.span>
          </AnimatePresence>
          {!menuOpen ? (
            <span className="relative max-w-0 whitespace-nowrap text-[13.5px] font-semibold opacity-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:ml-2 group-hover:max-w-[140px] group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-[140px] group-focus-visible:opacity-100">
              Help &amp; feedback
            </span>
          ) : null}
        </button>
      </div>

      <NewTicketDialog
        open={dialogType !== null}
        initialType={dialogType ?? "bug"}
        onClose={() => setDialogType(null)}
      />
      <span className="sr-only" aria-live="polite">
        {dialogType ? `${TYPE_LABELS[dialogType]} form opened` : ""}
      </span>
    </>
  );
}
