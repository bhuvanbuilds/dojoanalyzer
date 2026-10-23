"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Bug, CheckCircle2, Lightbulb, MessageCircleWarning } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormBanner, GhostButton, SubmitButton, TextField } from "@/components/ui/form";
import {
  LIMITS,
  SEVERITIES,
  SEVERITY_LABELS,
  STATUS_LABELS,
  TICKET_TYPES,
  TYPE_LABELS,
  type Severity,
  type TicketStatus,
  type TicketType,
} from "@/lib/support";

export const TYPE_META: Record<
  TicketType,
  { icon: typeof Bug; tint: string; soft: string; blurb: string; titleHint: string; bodyHint: string }
> = {
  feature: {
    icon: Lightbulb,
    tint: "#d97706",
    soft: "color-mix(in srgb, #f59e0b 14%, transparent)",
    blurb: "An idea that would make the analyzer better",
    titleHint: "e.g. Export the leaderboard as a PDF",
    bodyHint: "What would you like, and what would it help you do?",
  },
  bug: {
    icon: Bug,
    tint: "#dc2626",
    soft: "color-mix(in srgb, #ef4444 13%, transparent)",
    blurb: "Something is broken or looks wrong",
    titleHint: "e.g. Week filter resets after refreshing",
    bodyHint: "What did you do, what did you expect, and what happened instead?",
  },
  other: {
    icon: MessageCircleWarning,
    tint: "#2563eb",
    soft: "color-mix(in srgb, #3b82f6 13%, transparent)",
    blurb: "Access, data or anything else",
    titleHint: "e.g. My squad shows the wrong students",
    bodyHint: "Tell us what's going on and how we can help.",
  },
};

const STATUS_STYLE: Record<TicketStatus, { dot: string; className: string }> = {
  open: { dot: "#3b82f6", className: "bg-[color-mix(in_srgb,#3b82f6_12%,transparent)] text-[#2563eb] dark:text-[#93c5fd]" },
  in_progress: { dot: "#f59e0b", className: "bg-[color-mix(in_srgb,#f59e0b_14%,transparent)] text-[#b45309] dark:text-[#fcd34d]" },
  resolved: { dot: "#10b981", className: "bg-[color-mix(in_srgb,#10b981_13%,transparent)] text-[#047857] dark:text-[#6ee7b7]" },
  closed: { dot: "#9ca3af", className: "bg-sunken text-muted" },
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${style.className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: style.dot }} />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function TypeIcon({ type, size = 36 }: { type: TicketType; size?: number }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-xl"
      style={{ width: size, height: size, background: meta.soft, color: meta.tint }}
    >
      <Icon size={Math.round(size * 0.47)} strokeWidth={2.2} />
    </span>
  );
}

export function timeAgo(iso: string, now: number) {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Current time, refreshed each minute, for relative "5m ago" labels. */
export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/* ─── New ticket dialog ─────────────────────────────────────────────────── */

type Created = { id: string; number: number };

export function NewTicketDialog({
  open,
  initialType,
  initialTitle = "",
  onClose,
  onCreated,
}: {
  open: boolean;
  initialType: TicketType;
  /** Prefills the title, e.g. "Feedback: Maintenance mode" from the changelog. */
  initialTitle?: string;
  onClose: () => void;
  onCreated?: (ticket: Created) => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      eyebrow="Kalvium support"
      title="How can we help?"
      description="Your ticket goes straight to the Dojo Belt Analyzer team. You'll see every reply under My tickets."
    >
      {/* Remount per opening so every ticket starts from a clean form. */}
      {open ? (
        <TicketForm
          initialType={initialType}
          initialTitle={initialTitle}
          onClose={onClose}
          onCreated={onCreated}
        />
      ) : null}
    </Dialog>
  );
}

function TicketForm({
  initialType,
  initialTitle,
  onClose,
  onCreated,
}: {
  initialType: TicketType;
  initialTitle: string;
  onClose: () => void;
  onCreated?: (ticket: Created) => void;
}) {
  const [type, setType] = useState<TicketType>(initialType);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const meta = TYPE_META[type];

  const titleError =
    title.trim().length < LIMITS.titleMin
      ? `Add a short title (at least ${LIMITS.titleMin} characters)`
      : title.length > LIMITS.titleMax
        ? `Keep the title under ${LIMITS.titleMax} characters`
        : null;
  const descriptionError =
    description.trim().length < LIMITS.descriptionMin
      ? `A few more words, please (at least ${LIMITS.descriptionMin} characters)`
      : description.length > LIMITS.descriptionMax
        ? `Keep it under ${LIMITS.descriptionMax} characters`
        : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (titleError || descriptionError) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title,
          description,
          severity: type === "bug" ? severity : null,
          pageUrl: window.location.pathname + window.location.search,
        }),
      });
      const result = (await response.json()) as { ticket?: Created; error?: string };
      if (!response.ok || !result.ticket) throw new Error(result.error ?? "Couldn't send your ticket.");
      setCreated(result.ticket);
      onCreated?.(result.ticket);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Couldn't send your ticket.");
    } finally {
      setPending(false);
    }
  }

  if (created)
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center px-6 pb-8 pt-4 text-center"
      >
        <span className="grid h-14 w-14 place-items-center rounded-full bg-success-soft text-success-text">
          <CheckCircle2 size={28} />
        </span>
        <h3 className="mt-4 font-display text-[20px] font-bold tracking-[-0.02em]">
          Ticket #{created.number} is in
        </h3>
        <p className="mt-1.5 max-w-sm text-[14px] leading-6 text-muted">
          Thanks for telling us. We’ll reply on the ticket, and you can follow it any time
          from My tickets.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <GhostButton onClick={onClose}>Done</GhostButton>
          <Link
            href={`/support/${created.id}`}
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-page transition hover:opacity-90"
          >
            View ticket <ArrowRight size={15} />
          </Link>
        </div>
      </motion.div>
    );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6 px-6 pb-6 pt-1">
      <div role="radiogroup" aria-label="Ticket type" className="grid gap-2 sm:grid-cols-3">
        {TICKET_TYPES.map((option) => {
          const optionMeta = TYPE_META[option];
          const selected = option === type;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setType(option)}
              className={`group flex items-start gap-3 rounded-2xl border p-3 text-left transition ${
                selected
                  ? "border-ink bg-surface shadow-[0_0_0_3px_color-mix(in_srgb,var(--ink)_8%,transparent)]"
                  : "border-line hover:border-line-strong hover:bg-surface-2"
              }`}
            >
              <TypeIcon type={option} size={32} />
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-ink">
                  {TYPE_LABELS[option]}
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-muted">
                  {optionMeta.blurb}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <TextField
        label="Title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={meta.titleHint}
        maxChars={LIMITS.titleMax}
        error={touched ? titleError : null}
        autoFocus
      />

      <Field
        label="Details"
        error={touched ? descriptionError : null}
        hint={touched && descriptionError ? undefined : meta.bodyHint}
        counter={
          description.length > LIMITS.descriptionMax * 0.7
            ? { value: description.length, max: LIMITS.descriptionMax }
            : undefined
        }
      >
        {({ id, describedBy }) => (
          <textarea
            id={id}
            aria-describedby={describedBy}
            aria-invalid={Boolean(touched && descriptionError)}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={6}
            placeholder={meta.bodyHint}
            className={`w-full resize-y rounded-xl border bg-surface px-3.5 py-2.5 text-[14px] leading-6 text-ink outline-none transition placeholder:text-faint focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--ink)_8%,transparent)] ${
              touched && descriptionError ? "border-brand-text/70" : "border-line-strong focus:border-ink"
            }`}
          />
        )}
      </Field>

      <AnimatePresence initial={false}>
        {type === "bug" ? (
          <motion.div
            key="severity"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <p className="mb-2 text-[12.5px] font-semibold text-ink-2">How much does it hurt?</p>
            <div role="radiogroup" aria-label="Severity" className="flex flex-wrap gap-2">
              {SEVERITIES.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={severity === option}
                  onClick={() => setSeverity(option)}
                  className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
                    severity === option
                      ? "border-ink bg-ink text-page"
                      : "border-line-strong text-ink-2 hover:border-ink/40"
                  }`}
                >
                  {SEVERITY_LABELS[option]}
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <p className="rounded-xl bg-sunken px-3.5 py-2.5 text-[12.5px] leading-5 text-muted">
        We’ll attach the page you’re on and your browser, so you don’t have to describe where
        it happened.
      </p>

      <AnimatePresence>{error ? <FormBanner tone="error">{error}</FormBanner> : null}</AnimatePresence>

      <div className="flex justify-end gap-2.5">
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <SubmitButton pending={pending} pendingLabel="Sending">
          Send ticket
        </SubmitButton>
      </div>
    </form>
  );
}

export function EmptyTickets({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-sunken text-muted">
        <MessageCircleWarning size={24} />
      </span>
      {children}
    </div>
  );
}
