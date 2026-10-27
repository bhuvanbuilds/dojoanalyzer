"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { ChevronRight, MessageSquare, Plus, Search, X } from "lucide-react";
import { useUrlFilters } from "@/lib/use-url-filters";
import {
  STATUS_LABELS,
  TICKET_STATUSES,
  TICKET_TYPES,
  TYPE_LABELS,
  type Ticket,
  type TicketStatus,
} from "@/lib/support";
import { PageState } from "@/components/ui/skeleton";
import { Frame, FrameTitle, Page } from "@/components/ui/frame";
import { Dropdown } from "@/components/ui/dropdown";
import {
  EmptyTickets,
  NewTicketDialog,
  StatusBadge,
  TypeIcon,
  timeAgo,
  useNow,
} from "@/components/support/kit";

export default function SupportPage() {
  return (
    <Suspense fallback={<PageState message="Loading your tickets" loading />}>
      <Support />
    </Suspense>
  );
}

type ListResponse = { tickets?: Ticket[]; isStaff?: boolean; error?: string };

function Support() {
  const now = useNow();
  const [filters, setFilters] = useUrlFilters({ scope: "mine", status: "", type: "", q: "" });
  const [query, setQuery] = useState(filters.q);
  const [result, setResult] = useState<{ key: string; data: ListResponse } | null>(null);
  const [reload, setReload] = useState(0);
  const [creating, setCreating] = useState(false);

  // Typing updates the URL after a short pause, not on every key.
  useEffect(() => {
    if (query === filters.q) return;
    const timer = window.setTimeout(() => setFilters({ q: query }, { replace: true }), 300);
    return () => window.clearTimeout(timer);
  }, [query, filters.q, setFilters]);

  const params = new URLSearchParams(
    Object.entries({
      scope: filters.scope === "all" ? "all" : "",
      status: filters.status,
      type: filters.type,
      q: filters.q,
    }).filter(([, value]) => value),
  ).toString();
  const key = `${params}#${reload}`;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/support/tickets${params ? `?${params}` : ""}`, { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as ListResponse;
        setResult({ key, data: response.ok ? data : { error: data.error ?? "Couldn't load tickets." } });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResult({ key, data: { error: "Couldn't load tickets." } });
      });
    return () => controller.abort();
  }, [params, key]);

  const data = result?.data;
  const loading = !result || result.key !== key;
  const tickets = data?.tickets ?? [];
  const isStaff = Boolean(data?.isStaff);
  const all = isStaff && filters.scope === "all";
  const counts = TICKET_STATUSES.reduce(
    (total, status) => ({ ...total, [status]: tickets.filter((ticket) => ticket.status === status).length }),
    {} as Record<TicketStatus, number>,
  );

  if (data?.error && !data.tickets)
    return <PageState message="Couldn’t load tickets" detail={data.error} />;

  return (
    <Page>
      <Frame>
        <FrameTitle
          eyebrow="Kalvium support"
          title={all ? "All tickets" : "My tickets"}
          description={
            all
              ? "Every suggestion, bug and issue reported across the analyzer."
              : "Your suggestions, bug reports and questions, with every reply from the team."
          }
          actions={
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-page transition hover:opacity-90 active:scale-[0.98]"
            >
              <Plus size={16} /> New ticket
            </button>
          }
        />

        {isStaff ? (
          <div role="tablist" className="flex gap-1 border-b border-line px-4 sm:px-5">
            {(["mine", "all"] as const).map((scope) => (
              <button
                key={scope}
                type="button"
                role="tab"
                aria-selected={filters.scope === scope}
                onClick={() => setFilters({ scope })}
                className={`relative px-3 py-3 text-[13.5px] font-semibold transition ${
                  filters.scope === scope ? "text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {scope === "mine" ? "My tickets" : "All tickets"}
                {filters.scope === scope ? (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-action" />
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        {/* Status summary doubles as a quick filter. */}
        <div className="grid grid-cols-2 border-b border-line sm:grid-cols-4">
          {TICKET_STATUSES.map((status) => {
            const active = filters.status === status;
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                onClick={() => setFilters({ status: active ? "" : status })}
                className={`flex flex-col items-start gap-1 border-line px-4 py-3.5 text-left transition sm:px-5 [&:not(:last-child)]:border-r ${
                  active ? "bg-sunken" : "hover:bg-surface-2"
                }`}
              >
                <span className="text-[12px] font-medium text-muted">{STATUS_LABELS[status]}</span>
                <span className="font-display text-[22px] font-bold tabular-nums tracking-[-0.03em]">
                  {loading ? "–" : counts[status]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5 sm:px-5">
          <label className="relative min-w-[200px] flex-1">
            <span className="sr-only">Search tickets</span>
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={all ? "Search title, name or email" : "Search your tickets"}
              className="w-full rounded-xl border border-transparent bg-surface py-2 pl-8 pr-8 text-[13px] outline-none focus:border-line-strong"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              >
                <X size={13} />
              </button>
            ) : null}
          </label>
          <Dropdown
            chevron
            aria-label="Filter by type"
            value={filters.type}
            onChange={(value) => setFilters({ type: value })}
            className="h-9 min-w-[150px] rounded-xl border border-line bg-surface px-3 text-[13px] font-semibold text-ink-2"
          >
            <option value="">All types</option>
            {TICKET_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </Dropdown>
        </div>

        {loading && !tickets.length ? (
          <div className="px-5 py-16 text-center text-[13px] text-muted">Loading tickets…</div>
        ) : tickets.length === 0 ? (
          <EmptyTickets>
            <p className="mt-4 font-display text-[17px] font-bold">
              {filters.status || filters.type || filters.q ? "No tickets match" : "No tickets yet"}
            </p>
            <p className="mt-1 max-w-sm text-[13.5px] text-muted">
              {filters.status || filters.type || filters.q
                ? "Try another filter or search."
                : "Spotted a bug or have an idea? Tell us — it takes a minute."}
            </p>
          </EmptyTickets>
        ) : (
          <ul className={`divide-y divide-line transition-opacity ${loading ? "opacity-60" : ""}`}>
            {tickets.map((ticket) => (
              <li key={ticket.id} className="[content-visibility:auto] [contain-intrinsic-size:auto_76px]">
                <Link
                  href={`/support/${ticket.id}`}
                  className="group flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-surface-2 sm:px-5"
                >
                  <TypeIcon type={ticket.type} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="font-mono text-[12px] text-faint">#{ticket.number}</span>
                      <span className="truncate font-display text-[14.5px] font-semibold text-ink group-hover:underline">
                        {ticket.title}
                      </span>
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-muted">
                      <span>{TYPE_LABELS[ticket.type]}</span>
                      {all ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{ticket.reporter_name ?? ticket.reporter_email}</span>
                        </>
                      ) : null}
                      <span aria-hidden="true">·</span>
                      <span>Updated {timeAgo(ticket.updated_at, now)}</span>
                      {ticket.message_count ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1">
                            <MessageSquare size={12} /> {ticket.message_count}
                          </span>
                        </>
                      ) : null}
                    </span>
                  </span>
                  <StatusBadge status={ticket.status} />
                  <ChevronRight
                    size={16}
                    className="hidden text-faint transition group-hover:translate-x-0.5 group-hover:text-ink sm:block"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Frame>

      <NewTicketDialog
        open={creating}
        initialType="bug"
        onClose={() => setCreating(false)}
        onCreated={() => setReload((value) => value + 1)}
      />
    </Page>
  );
}
