"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Inbox, MessageSquare, Newspaper, RefreshCw, Search, UserRound, X } from "lucide-react";
import { getCurrentUserProfile, type CurrentUserProfile } from "@/lib/auth/profile";
import { useUrlFilters } from "@/lib/use-url-filters";
import {
  SEVERITIES,
  SEVERITY_LABELS,
  TICKET_TYPES,
  TYPE_LABELS,
  type Ticket,
  type TicketStatus,
} from "@/lib/support";
import { PageState } from "@/components/ui/skeleton";
import { Dropdown } from "@/components/ui/dropdown";
import { StatusBadge, TypeIcon, timeAgo, useNow } from "@/components/support/kit";
import { TicketConversation } from "@/components/support/ticket-conversation";

const VIEWS: Array<{ key: string; label: string; statuses: TicketStatus[] | null }> = [
  { key: "active", label: "Active", statuses: ["open", "in_progress"] },
  { key: "open", label: "Open", statuses: ["open"] },
  { key: "in_progress", label: "In progress", statuses: ["in_progress"] },
  { key: "resolved", label: "Resolved", statuses: ["resolved"] },
  { key: "closed", label: "Closed", statuses: ["closed"] },
  { key: "all", label: "All", statuses: null },
];

const SEVERITY_DOT: Record<string, string> = { high: "#dc2626", medium: "#f59e0b", low: "#9ca3af" };
const REFRESH_MS = 15_000;

export default function TicketsWorkspacePage() {
  return (
    <Suspense fallback={<PageState message="Loading tickets" loading />}>
      <Workspace />
    </Suspense>
  );
}

function Workspace() {
  const router = useRouter();
  const now = useNow();
  const [account, setAccount] = useState<CurrentUserProfile | null>(null);
  const [filters, setFilters] = useUrlFilters({
    view: "active",
    type: "",
    severity: "",
    assignee: "",
    q: "",
    t: "",
  });
  const [query, setQuery] = useState(filters.q);
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState("");
  const [refreshedAt, setRefreshedAt] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    getCurrentUserProfile().then((result) => {
      if (!active) return;
      setAccount(result);
      if (result.status === "unauthenticated") router.replace("/login");
      else if (result.status !== "authenticated" || result.profile.role !== "super_admin")
        router.replace("/support");
    });
    return () => {
      active = false;
    };
  }, [router]);
  const staff = account?.status === "authenticated" && account.profile.role === "super_admin";
  const myId = account?.status === "authenticated" ? account.user.id : null;

  useEffect(() => {
    if (query === filters.q) return;
    const timer = window.setTimeout(() => setFilters({ q: query }, { replace: true }), 300);
    return () => window.clearTimeout(timer);
  }, [query, filters.q, setFilters]);

  // All tickets once, then a quiet refresh every few seconds.
  useEffect(() => {
    if (!staff) return;
    let active = true;
    const controller = new AbortController();
    const params = new URLSearchParams({ scope: "all" });
    if (filters.q) params.set("q", filters.q);
    async function load() {
      try {
        const response = await fetch(`/api/support/tickets?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const result = (await response.json()) as { tickets?: Ticket[]; error?: string };
        if (!active) return;
        if (!response.ok) throw new Error(result.error ?? "Couldn’t load tickets.");
        setTickets(result.tickets ?? []);
        setError("");
        setRefreshedAt(Date.now());
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        if (active) setError(loadError instanceof Error ? loadError.message : "Couldn’t load tickets.");
      }
    }
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [staff, filters.q, tick]);

  const all = useMemo(() => tickets ?? [], [tickets]);
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const stats = {
    open: all.filter((ticket) => ticket.status === "open").length,
    inProgress: all.filter((ticket) => ticket.status === "in_progress").length,
    unassigned: all.filter((ticket) => !ticket.assigned_to && (ticket.status === "open" || ticket.status === "in_progress")).length,
    high: all.filter((ticket) => ticket.severity === "high" && ticket.status !== "resolved" && ticket.status !== "closed").length,
    resolvedWeek: all.filter((ticket) => ticket.resolved_at && Date.parse(ticket.resolved_at) >= weekAgo).length,
  };

  const view = VIEWS.find((item) => item.key === filters.view) ?? VIEWS[0];
  const shown = all.filter(
    (ticket) =>
      (!view.statuses || view.statuses.includes(ticket.status)) &&
      (!filters.type || ticket.type === filters.type) &&
      (!filters.severity || ticket.severity === filters.severity) &&
      (!filters.assignee ||
        (filters.assignee === "me" ? ticket.assigned_to === myId : !ticket.assigned_to)),
  );
  const countFor = (statuses: TicketStatus[] | null) =>
    all.filter((ticket) => !statuses || statuses.includes(ticket.status)).length;
  const selectedId = filters.t || null;

  if (!staff) return <PageState message="Checking your account" loading />;
  if (error && !tickets) return <PageState message="Couldn’t load tickets" detail={error} />;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-3 pb-10 pt-5 sm:px-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 px-1">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-action">Kalvium support</p>
          <h1 className="mt-1 font-display text-[28px] font-bold leading-tight tracking-[-0.03em]">Tickets</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            Triage, reply and close the loop. Conversations update live; this list refreshes every
            15 seconds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-[12px] text-faint sm:inline">
            {refreshedAt ? `Updated ${timeAgo(new Date(refreshedAt).toISOString(), now)}` : ""}
          </span>
          <button
            type="button"
            aria-label="Refresh tickets"
            onClick={() => setTick((value) => value + 1)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-line-strong text-muted transition hover:text-ink"
          >
            <RefreshCw size={14} />
          </button>
          <Link
            href="/changelog"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line-strong px-3 text-[13px] font-semibold text-ink-2 transition hover:border-ink/40 hover:text-ink"
          >
            <Newspaper size={14} /> What’s new
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-surface sm:grid-cols-5">
        {(
          [
            ["Needs reply", stats.open, () => setFilters({ view: "open", assignee: "" }), "#3b82f6"],
            ["In progress", stats.inProgress, () => setFilters({ view: "in_progress", assignee: "" }), "#f59e0b"],
            ["Unassigned", stats.unassigned, () => setFilters({ view: "active", assignee: "none" }), "#8b5cf6"],
            ["High severity", stats.high, () => setFilters({ view: "active", severity: "high" }), "#dc2626"],
            ["Resolved · 7 days", stats.resolvedWeek, () => setFilters({ view: "resolved", assignee: "", severity: "" }), "#10b981"],
          ] as Array<[string, number, () => void, string]>
        ).map(([label, value, apply, color]) => (
          <button
            key={label}
            type="button"
            onClick={apply}
            className="flex flex-col items-start gap-1 border-line px-4 py-3.5 text-left transition hover:bg-surface-2 sm:px-5 [&:not(:last-child)]:border-r [&:nth-child(-n+4)]:border-b sm:[&:nth-child(-n+4)]:border-b-0"
          >
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
              {label}
            </span>
            <span className="font-display text-[26px] font-bold tabular-nums tracking-[-0.03em]">
              {tickets ? value : "–"}
            </span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Status" className="flex flex-wrap gap-1 rounded-xl bg-sunken p-1">
          {VIEWS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={view.key === item.key}
              onClick={() => setFilters({ view: item.key })}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition ${
                view.key === item.key ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {item.label}
              <span className="font-mono text-[11px] tabular-nums text-faint">{tickets ? countFor(item.statuses) : ""}</span>
            </button>
          ))}
        </div>
        <Dropdown
          chevron
          aria-label="Type"
          value={filters.type}
          onChange={(value) => setFilters({ type: value })}
          className="h-9 min-w-[130px] rounded-xl border border-line bg-surface px-3 text-[13px] font-semibold text-ink-2"
        >
          <option value="">All types</option>
          {TICKET_TYPES.map((type) => (
            <option key={type} value={type}>
              {TYPE_LABELS[type]}
            </option>
          ))}
        </Dropdown>
        <Dropdown
          chevron
          aria-label="Severity"
          value={filters.severity}
          onChange={(value) => setFilters({ severity: value })}
          className="h-9 min-w-[140px] rounded-xl border border-line bg-surface px-3 text-[13px] font-semibold text-ink-2"
        >
          <option value="">Any severity</option>
          {SEVERITIES.map((severity) => (
            <option key={severity} value={severity}>
              {SEVERITY_LABELS[severity]}
            </option>
          ))}
        </Dropdown>
        <Dropdown
          chevron
          aria-label="Assignee"
          value={filters.assignee}
          onChange={(value) => setFilters({ assignee: value })}
          className="h-9 min-w-[130px] rounded-xl border border-line bg-surface px-3 text-[13px] font-semibold text-ink-2"
        >
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="none">Unassigned</option>
        </Dropdown>
        <label className="relative min-w-[200px] flex-1">
          <span className="sr-only">Search tickets</span>
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, reporter or email"
            className="h-9 w-full rounded-xl border border-line bg-surface pl-8 pr-8 text-[13px] outline-none focus:border-line-strong"
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
      </div>

      {/* List + conversation */}
      <div className="mt-4 grid overflow-hidden rounded-2xl border border-line bg-surface lg:h-[calc(100dvh-var(--app-bar-h,97px)-300px)] lg:min-h-[560px] lg:grid-cols-[380px_minmax(0,1fr)]">
        <ul className="min-h-0 divide-y divide-line overflow-y-auto border-line lg:border-r">
          {!tickets ? (
            <li className="px-5 py-10 text-center text-[13px] text-muted">Loading tickets…</li>
          ) : shown.length === 0 ? (
            <li className="flex flex-col items-center px-6 py-14 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sunken text-muted">
                <Inbox size={20} />
              </span>
              <p className="mt-3 font-display text-[15px] font-bold">
                {all.length ? "Nothing here" : "No tickets yet"}
              </p>
              <p className="mt-1 text-[12.5px] text-muted">
                {all.length ? "No tickets match these filters." : "New reports land here the moment they’re filed."}
              </p>
            </li>
          ) : (
            shown.map((ticket) => {
              const selected = ticket.id === selectedId;
              return (
                <li key={ticket.id}>
                  <button
                    type="button"
                    onClick={() => {
                      // Small screens get the full ticket page instead of a panel.
                      if (window.matchMedia("(max-width: 1023px)").matches) router.push(`/support/${ticket.id}`);
                      else setFilters({ t: ticket.id }, { replace: true });
                    }}
                    className={`relative flex w-full gap-3 px-4 py-3.5 text-left transition ${
                      selected ? "bg-sunken" : "hover:bg-surface-2"
                    }`}
                  >
                    {selected ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-action" /> : null}
                    <TypeIcon type={ticket.type} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-1.5">
                        <span className="font-mono text-[11.5px] text-faint">#{ticket.number}</span>
                        <span className="truncate text-[13.5px] font-semibold text-ink">{ticket.title}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-muted">
                        {ticket.reporter_name ?? ticket.reporter_email} · {timeAgo(ticket.updated_at, now)}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={ticket.status} />
                        {ticket.severity ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sunken px-2 py-0.5 text-[11px] font-semibold text-ink-2">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: SEVERITY_DOT[ticket.severity] }} />
                            {ticket.severity}
                          </span>
                        ) : null}
                        {ticket.message_count ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-faint">
                            <MessageSquare size={11} /> {ticket.message_count}
                          </span>
                        ) : null}
                        {!ticket.assigned_to && (ticket.status === "open" || ticket.status === "in_progress") ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-faint">
                            <UserRound size={11} /> unassigned
                          </span>
                        ) : ticket.assigned_to === myId ? (
                          <span className="text-[11px] font-semibold text-action">yours</span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <section className="hidden min-h-0 lg:block">
          {selectedId ? (
            <TicketConversation
              key={selectedId}
              ticketId={selectedId}
              variant="panel"
              onChange={(patch) =>
                setTickets((list) =>
                  list ? list.map((ticket) => (ticket.id === patch.id ? { ...ticket, ...patch } : ticket)) : list,
                )
              }
            />
          ) : (
            <div className="grid h-full place-items-center px-6 text-center">
              <div>
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-sunken text-muted">
                  <MessageSquare size={22} />
                </span>
                <p className="mt-3 font-display text-[16px] font-bold">Pick a ticket</p>
                <p className="mt-1 text-[13px] text-muted">Its conversation, triage and history open here.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
