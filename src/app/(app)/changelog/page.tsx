"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Bug, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import {
  CHANGELOG_KINDS,
  CHANGELOG_LABELS,
  type ChangelogEntry,
  type ChangelogKind,
} from "@/lib/support";
import { PageState } from "@/components/ui/skeleton";
import { Frame, FrameTitle, Page } from "@/components/ui/frame";
import { FormBanner } from "@/components/ui/form";

const KIND_STYLE: Record<ChangelogKind, { icon: typeof Bug; tint: string; soft: string }> = {
  fix: { icon: Bug, tint: "#dc2626", soft: "color-mix(in srgb, #ef4444 13%, transparent)" },
  feature: { icon: Sparkles, tint: "#7c3aed", soft: "color-mix(in srgb, #8b5cf6 14%, transparent)" },
  improvement: { icon: Wand2, tint: "#0284c7", soft: "color-mix(in srgb, #0ea5e9 14%, transparent)" },
};

function KindBadge({ kind }: { kind: ChangelogKind }) {
  const style = KIND_STYLE[kind];
  const Icon = style.icon;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold"
      style={{ background: style.soft, color: style.tint }}
    >
      <Icon size={12} /> {CHANGELOG_LABELS[kind]}
    </span>
  );
}

export default function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [error, setError] = useState("");
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/changelog?drafts=1", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as { entries?: ChangelogEntry[]; isStaff?: boolean; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Couldn’t load what’s new.");
        if (!active) return;
        setEntries(result.entries ?? []);
        setIsStaff(Boolean(result.isStaff));
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Couldn’t load what’s new.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function act(entry: ChangelogEntry, action: "publish" | "unpublish" | "delete") {
    setError("");
    const response = await fetch(`/api/changelog/${entry.id}`, {
      method: action === "delete" ? "DELETE" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: action === "delete" ? undefined : JSON.stringify({ published: action === "publish" }),
    });
    const result = (await response.json()) as { entry?: ChangelogEntry; error?: string };
    if (!response.ok) return setError(result.error ?? "Couldn’t save that change.");
    setEntries((list) =>
      !list
        ? list
        : action === "delete"
          ? list.filter((item) => item.id !== entry.id)
          : list.map((item) => (item.id === entry.id && result.entry ? result.entry : item)),
    );
  }

  if (error && !entries) return <PageState message="Couldn’t load what’s new" detail={error} />;
  if (!entries) return <PageState message="Loading what’s new" loading />;

  const published = entries.filter((entry) => entry.published && entry.published_at);
  const drafts = entries.filter((entry) => !entry.published);

  return (
    <Page>
      <Frame>
        <FrameTitle
          eyebrow="Changelog"
          title="What’s new"
          description="Fixes, new features and improvements to Dojo Belt Analyzer, newest first."
          actions={
            isStaff ? (
              <button
                type="button"
                onClick={() => setComposing((open) => !open)}
                className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-page transition hover:opacity-90"
              >
                <Plus size={15} /> New entry
              </button>
            ) : null
          }
        />

        <AnimatePresence>
          {error ? (
            <div className="px-4 pt-4 sm:px-6">
              <FormBanner tone="error">{error}</FormBanner>
            </div>
          ) : null}
        </AnimatePresence>

        {isStaff && composing ? (
          <Composer
            onCreated={(entry) => {
              setEntries((list) => [entry, ...(list ?? [])]);
              setComposing(false);
            }}
          />
        ) : null}

        {isStaff && drafts.length ? (
          <section className="border-b border-line bg-surface-2 px-4 py-5 sm:px-6">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">Drafts · only staff see these</h2>
            <ul className="mt-3 space-y-2">
              {drafts.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
                  <KindBadge kind={entry.kind} />
                  <span className="min-w-0 flex-1 text-[13.5px] font-semibold">{entry.title}</span>
                  {entry.ticket_number ? (
                    <Link href={`/support/${entry.ticket_id}`} className="font-mono text-[12px] text-muted hover:underline">
                      #{entry.ticket_number}
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void act(entry, "publish")}
                    className="rounded-lg bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-page transition hover:opacity-90"
                  >
                    Publish
                  </button>
                  <button
                    type="button"
                    aria-label="Delete draft"
                    onClick={() => void act(entry, "delete")}
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-sunken hover:text-brand-text"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {published.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-20 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-sunken text-muted">
              <Sparkles size={22} />
            </span>
            <p className="mt-4 font-display text-[17px] font-bold">Nothing published yet</p>
            <p className="mt-1 max-w-sm text-[13.5px] text-muted">
              {isStaff
                ? "Add an entry here, or use “Add to changelog” on a fixed bug ticket."
                : "Release notes will show up here as the team ships changes."}
            </p>
          </div>
        ) : (
          <div className="px-4 sm:px-6">
            {published.map((entry, index) => (
              <article
                key={entry.id}
                className={`grid gap-4 py-10 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10 ${index ? "border-t border-line" : ""}`}
              >
                {/* Date rail: stays in view while the entry scrolls past */}
                <div className="md:sticky md:top-[calc(var(--app-bar-h,57px)+24px)] md:self-start">
                  <time
                    dateTime={entry.published_at!}
                    className="block text-[13.5px] font-medium text-muted"
                  >
                    {new Date(entry.published_at!).toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </time>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <KindBadge kind={entry.kind} />
                    {entry.ticket_number ? (
                      isStaff ? (
                        <Link
                          href={`/support/${entry.ticket_id}`}
                          className="rounded-full border border-line px-2.5 py-1 font-mono text-[11px] text-muted transition hover:border-line-strong hover:text-ink"
                        >
                          #{entry.ticket_number}
                        </Link>
                      ) : (
                        <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[11px] text-muted">
                          #{entry.ticket_number}
                        </span>
                      )
                    ) : null}
                  </div>
                </div>

                <div className="min-w-0">
                  <h2 className="font-display text-[22px] font-bold leading-tight tracking-[-0.025em] text-balance sm:text-[26px]">
                    {entry.title}
                  </h2>
                  {entry.body ? (
                    <p className="mt-3 max-w-[68ch] whitespace-pre-wrap text-[15px] leading-7 text-ink-2">{entry.body}</p>
                  ) : null}
                  {entry.image_url ? (
                    <figure className="mt-5 overflow-hidden rounded-xl border border-line bg-surface-2 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(0,0,0,0.25)]">
                      <Image
                        src={entry.image_url}
                        alt={`Screenshot: ${entry.title}`}
                        width={1440}
                        height={720}
                        sizes="(min-width: 1024px) 860px, 100vw"
                        // Already-compressed WebP on Supabase's CDN: load it directly.
                        unoptimized
                        className="h-auto w-full"
                      />
                    </figure>
                  ) : null}
                  {isStaff ? (
                    <button
                      type="button"
                      onClick={() => void act(entry, "unpublish")}
                      className="mt-4 text-[12.5px] font-semibold text-muted underline-offset-4 hover:text-ink hover:underline"
                    >
                      Unpublish
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </Frame>
    </Page>
  );
}

function Composer({ onCreated }: { onCreated: (entry: ChangelogEntry) => void }) {
  const [kind, setKind] = useState<ChangelogKind>("improvement");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function save(publish: boolean) {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/changelog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, title, body, publish }),
      });
      const result = (await response.json()) as { entry?: ChangelogEntry; error?: string };
      if (!response.ok || !result.entry) throw new Error(result.error ?? "Couldn’t save it.");
      onCreated(result.entry);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Couldn’t save it.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="border-b border-line px-4 py-5 sm:px-6">
      <div className="max-w-2xl space-y-3">
        <div role="radiogroup" aria-label="Kind" className="flex flex-wrap gap-2">
          {CHANGELOG_KINDS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={kind === option}
              onClick={() => setKind(option)}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
                kind === option ? "border-ink bg-ink text-page" : "border-line-strong text-ink-2 hover:border-ink/40"
              }`}
            >
              {CHANGELOG_LABELS[option]}
            </button>
          ))}
        </div>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={140}
          placeholder="e.g. Weekly comparison now shows belt gains per language"
          aria-label="Title"
          className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-[14px] outline-none placeholder:text-faint focus:border-ink"
        />
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Details for users (optional)"
          aria-label="Details"
          className="w-full resize-y rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-[14px] leading-6 outline-none placeholder:text-faint focus:border-ink"
        />
        <AnimatePresence>{error ? <FormBanner tone="error">{error}</FormBanner> : null}</AnimatePresence>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || title.trim().length < 3}
            onClick={() => void save(true)}
            className="rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-page transition hover:opacity-90 disabled:opacity-40"
          >
            Publish
          </button>
          <button
            type="button"
            disabled={pending || title.trim().length < 3}
            onClick={() => void save(false)}
            className="rounded-xl border border-line-strong px-4 py-2.5 text-[13.5px] font-semibold text-ink-2 transition hover:border-ink/40 disabled:opacity-40"
          >
            Save draft
          </button>
        </div>
      </div>
    </section>
  );
}
