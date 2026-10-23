"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bug, Sparkles, Wand2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { CHANGELOG_LABELS, type ChangelogEntry, type ChangelogKind } from "@/lib/support";

const SEEN_KEY = "dojo:changelog-seen";
const FIRST_VISIT_LIMIT = 3;

const KIND_STYLE: Record<ChangelogKind, { icon: typeof Bug; tint: string; soft: string }> = {
  fix: { icon: Bug, tint: "#dc2626", soft: "color-mix(in srgb, #ef4444 13%, transparent)" },
  feature: { icon: Sparkles, tint: "#7c3aed", soft: "color-mix(in srgb, #8b5cf6 14%, transparent)" },
  improvement: { icon: Wand2, tint: "#0284c7", soft: "color-mix(in srgb, #0ea5e9 14%, transparent)" },
};

function readSeen() {
  try {
    return window.localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

function writeSeen(value: string) {
  try {
    window.localStorage.setItem(SEEN_KEY, value);
  } catch {
    // Private mode or blocked storage: the popup may show again; that's fine.
  }
}

/**
 * After new release notes are published, shows them once when someone opens
 * the app. "Seen" is remembered per browser by the newest publish time.
 */
export function WhatsNewPopup() {
  const pathname = usePathname();
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [open, setOpen] = useState(false);
  const onChangelog = pathname === "/changelog";

  useEffect(() => {
    let active = true;
    fetch("/api/changelog", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { entries: [] }))
      .then((result: { entries?: ChangelogEntry[] }) => {
        if (!active) return;
        const published = (result.entries ?? [])
          .filter((entry) => entry.published && entry.published_at)
          .sort((a, b) => b.published_at!.localeCompare(a.published_at!));
        const newest = published[0]?.published_at;
        if (!newest) return;
        const seen = readSeen();
        if (seen && seen >= newest) return;
        // Reading the changelog itself counts as having seen it.
        if (window.location.pathname === "/changelog") {
          writeSeen(newest);
          return;
        }
        const fresh = seen
          ? published.filter((entry) => entry.published_at! > seen)
          : published.slice(0, FIRST_VISIT_LIMIT);
        setEntries(fresh);
        setOpen(fresh.length > 0);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  function dismiss() {
    const newest = entries[0]?.published_at;
    if (newest) writeSeen(newest);
    setOpen(false);
  }

  if (!entries.length || onChangelog) return null;
  const shown = entries.slice(0, 4);
  const hero = shown.find((entry) => entry.image_url);

  return (
    <Dialog
      open={open}
      onClose={dismiss}
      size="lg"
      eyebrow="What’s new"
      title={entries.length === 1 ? "A new update just landed" : `${entries.length} new updates`}
      description="Here’s what changed since you were last here."
      footer={
        <>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-xl border border-line-strong px-4 py-2.5 text-[13.5px] font-semibold text-ink-2 transition hover:border-ink/40 hover:text-ink"
          >
            Got it
          </button>
          <Link
            href="/changelog"
            onClick={dismiss}
            className="rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-page transition hover:opacity-90"
          >
            See all updates
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-6 pb-5">
        {hero?.image_url ? (
          <figure className="overflow-hidden rounded-xl border border-line bg-surface-2">
            <Image
              src={hero.image_url}
              alt={`Screenshot: ${hero.title}`}
              width={1440}
              height={720}
              sizes="(min-width: 640px) 640px, 100vw"
              unoptimized
              className="h-auto max-h-64 w-full object-cover object-top"
            />
          </figure>
        ) : null}
        <ul className="flex flex-col divide-y divide-line">
          {shown.map((entry) => {
            const style = KIND_STYLE[entry.kind];
            const Icon = style.icon;
            return (
              <li key={entry.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span
                  className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                  style={{ background: style.soft, color: style.tint }}
                >
                  <Icon size={15} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: style.tint }}>
                    {CHANGELOG_LABELS[entry.kind]}
                  </p>
                  <p className="mt-0.5 text-[14.5px] font-semibold leading-snug">{entry.title}</p>
                  {entry.body ? (
                    <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted">{entry.body}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        {entries.length > shown.length ? (
          <p className="text-[12.5px] text-muted">+ {entries.length - shown.length} more on the What’s new page</p>
        ) : null}
      </div>
    </Dialog>
  );
}
