"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Check, ExternalLink, Flame, Link2, Pencil, X } from "lucide-react";
import { Heatmap } from "@/components/leetcode/heatmap";
import { LeetCodeLogo } from "@/components/leetcode/leetcode-logo";
import { cardStatus, type LeetCodeCard } from "@/lib/leetcode";

const STATUS = {
  solved: {
    card: "border-emerald-500/40 bg-emerald-500/[0.07] dark:bg-emerald-500/[0.09]",
    bar: "bg-emerald-500",
    pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  pending: {
    card: "border-red-500/40 bg-red-500/[0.06] dark:bg-red-500/[0.08]",
    bar: "bg-red-500",
    pill: "bg-red-500/15 text-red-700 dark:text-red-300",
  },
  missing: {
    card: "border-dashed border-line-strong bg-surface",
    bar: "bg-line-strong",
    pill: "bg-sunken text-muted",
  },
} as const;

export function Avatar({ name, src, size = 56 }: { name: string; src: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  if (src && !broken)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- LeetCode avatars come from several hosts.
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        onError={() => setBroken(true)}
        className="shrink-0 rounded-full object-cover ring-2 ring-surface"
        style={{ width: size, height: size }}
      />
    );
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-sunken font-display font-bold text-ink-2 ring-2 ring-surface"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials || "?"}
    </span>
  );
}

function statusLabel(card: LeetCodeCard) {
  const status = cardStatus(card);
  if (status === "missing") return "No LeetCode linked";
  if (status === "solved") return `Solved ${card.solved_today} today`;
  return "Not solved today";
}

/** Long card: avatar on the left, colour by today's status, heatmap and totals. */
export function LeetCodeCardView({
  card,
  today,
  index = 0,
  showCampus = false,
  self = false,
  onSaveUsername,
}: {
  card: LeetCodeCard;
  today: string;
  index?: number;
  showCampus?: boolean;
  /** The student's own card, on their LeetCode page. */
  self?: boolean;
  /** When given, staff can link or change the username in place. */
  onSaveUsername?: (username: string) => Promise<void>;
}) {
  const status = cardStatus(card);
  const style = STATUS[status];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.username ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!onSaveUsername) return;
    setSaving(true);
    setError("");
    try {
      await onSaveUsername(draft);
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Couldn’t save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.03 }}
      className={`relative flex min-w-0 gap-4 overflow-hidden rounded-xl border p-4 pl-5 transition-colors ${style.card}`}
    >
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${style.bar}`} />
      <Avatar name={card.name} src={card.avatar_url} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/student/${card.student_id}/leetcode`} className="block truncate font-display text-[15px] font-bold tracking-[-0.01em] text-ink hover:underline">
              {card.name}
            </Link>
            <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted">
              <span>
                {showCampus && card.university_name ? `${card.university_name} · ` : ""}Squad {card.squad_number}
              </span>
              {card.username && !editing ? (
                <a
                  href={`https://leetcode.com/u/${card.username}/`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium text-ink-2 hover:text-ink"
                >
                  · <LeetCodeLogo size={11} /> {card.username} <ExternalLink size={11} />
                </a>
              ) : null}
              {onSaveUsername && !editing ? (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(card.username ?? "");
                    setEditing(true);
                  }}
                  aria-label={card.username ? "Change LeetCode username" : "Link LeetCode username"}
                  className="inline-flex items-center gap-1 rounded px-1 text-faint hover:text-ink"
                >
                  {card.username ? <Pencil size={11} /> : <><Link2 size={12} /> Link</>}
                </button>
              ) : null}
            </p>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${style.pill}`}>
            {status === "solved" ? <Check size={12} strokeWidth={3} /> : null}
            {statusLabel(card)}
          </span>
        </div>

        {editing ? (
          <form
            className="mt-3 flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="LeetCode username or profile link"
              className="h-8 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] outline-none focus:border-ink"
            />
            <button type="submit" disabled={saving} className="h-8 rounded-lg bg-ink px-3 text-[12.5px] font-semibold text-page disabled:opacity-60">
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} aria-label="Cancel" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-sunken">
              <X size={14} />
            </button>
            {error ? <p className="w-full text-[12px] text-brand-text">{error}</p> : null}
          </form>
        ) : card.username ? (
          <div className="mt-3 flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
            <div className="min-w-0 overflow-hidden">
              <Heatmap days={card.activity_days} today={today} weeks={26} cell={10} gap={3} unit="submissions" />
            </div>
            <dl className="flex gap-4 text-center">
              <Stat label="Today" value={card.solved_today} tone={status === "solved" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"} />
              <Stat
                label="Streak"
                value={card.leetcode_streak ?? 0}
                icon={<Flame size={12} className="text-[#e8883a]" />}
              />
              <Stat label="Solved" value={card.total_solved ?? "—"} />
            </dl>
          </div>
        ) : (
          <p className="mt-3 text-[12.5px] text-muted">
            {self
              ? "Link your LeetCode username above to start tracking."
              : onSaveUsername
                ? "Link their LeetCode username to start tracking."
                : "Waiting for the student to link LeetCode."}
          </p>
        )}

        {card.username && card.total_solved !== null && !editing ? (
          <p className="mt-2 flex flex-wrap gap-x-3 text-[11.5px] text-muted">
            <span className="text-emerald-600 dark:text-emerald-400">Easy {card.easy_solved ?? 0}</span>
            <span className="text-amber-600 dark:text-amber-400">Medium {card.medium_solved ?? 0}</span>
            <span className="text-red-600 dark:text-red-400">Hard {card.hard_solved ?? 0}</span>
            {card.sync_error ? <span className="text-brand-text">· {card.sync_error}</span> : null}
          </p>
        ) : card.sync_error && !editing ? (
          <p className="mt-2 text-[11.5px] text-brand-text">{card.sync_error}</p>
        ) : null}
      </div>
    </motion.article>
  );
}

function Stat({ label, value, tone = "text-ink", icon }: { label: string; value: number | string; tone?: string; icon?: React.ReactNode }) {
  return (
    <div>
      <dd className={`inline-flex items-center gap-1 font-display text-[20px] font-bold leading-none tabular-nums ${tone}`}>
        {icon}
        {value}
      </dd>
      <dt className="mt-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">{label}</dt>
    </div>
  );
}
