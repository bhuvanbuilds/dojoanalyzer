"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ExternalLink,
  Globe,
  Lock,
  Monitor,
  Newspaper,
  ArrowUp,
  RotateCcw,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import {
  CHANGELOG_KINDS,
  CHANGELOG_LABELS,
  LIMITS,
  SEVERITIES,
  SEVERITY_LABELS,
  STATUS_LABELS,
  TICKET_STATUSES,
  TYPE_LABELS,
  type ChangelogKind,
  type StaffMember,
  type Ticket,
  type TicketMessage,
  type TicketStatus,
} from "@/lib/support";
import { Dialog } from "@/components/ui/dialog";
import { Dropdown } from "@/components/ui/dropdown";
import { FormBanner, GhostButton, SubmitButton, TextField } from "@/components/ui/form";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, TypeIcon, timeAgo, useNow } from "@/components/support/kit";

export type TicketDetail = Ticket & { user_agent: string | null };

type Detail = {
  ticket: TicketDetail;
  messages: TicketMessage[];
  isStaff: boolean;
  isDeveloper?: boolean;
  isOwner: boolean;
  staff?: StaffMember[];
};

const POLL_MS = 3000;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/**
 * One ticket with its live thread. New replies appear within a few seconds
 * without refreshing (the page polls for messages newer than the last one).
 * Staff get triage controls, internal notes and "Add to changelog".
 */
export function TicketConversation({
  ticketId,
  variant = "page",
  onChange,
}: {
  ticketId: string;
  /** "page" for /support/[id]; "panel" inside the tickets workspace. */
  variant?: "page" | "panel";
  onChange?: (ticket: Partial<TicketDetail> & { id: string }) => void;
}) {
  const now = useNow();
  const [detail, setDetail] = useState<{ id: string; data: Detail } | null>(null);
  const [loadState, setLoadState] = useState<{ id: string; status: "missing" | "error"; message?: string } | null>(null);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState("");
  const [changelogOpen, setChangelogOpen] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const lastAt = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const current = detail?.id === ticketId ? detail.data : null;
  const failure = loadState?.id === ticketId ? loadState : null;

  // First load, then poll for anything newer while the tab is visible.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    lastAt.current = null;

    async function load(initial: boolean) {
      const after = !initial && lastAt.current ? `?after=${encodeURIComponent(lastAt.current)}` : "";
      try {
        const response = await fetch(`/api/support/tickets/${ticketId}${after}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!active) return;
        if (response.status === 404) {
          setLoadState({ id: ticketId, status: "missing" });
          return;
        }
        const data = (await response.json()) as Detail & { error?: string };
        if (!response.ok) {
          if (initial) setLoadState({ id: ticketId, status: "error", message: data.error });
          return;
        }
        const newest = data.messages.at(-1)?.created_at;
        if (newest) lastAt.current = newest;
        setDetail((previous) => {
          if (initial || !previous || previous.id !== ticketId) return { id: ticketId, data };
          const known = new Set(previous.data.messages.map((message) => message.id));
          const fresh = data.messages.filter((message) => !known.has(message.id));
          return {
            id: ticketId,
            data: {
              ...previous.data,
              ticket: data.ticket,
              messages: fresh.length ? [...previous.data.messages, ...fresh] : previous.data.messages,
            },
          };
        });
        if (initial && !newest) lastAt.current = data.ticket.created_at;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (initial && active) setLoadState({ id: ticketId, status: "error" });
      }
    }

    void load(true);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(false);
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ticketId]);

  // Stick to the newest message unless the reader has scrolled up; then a
  // "New messages" pill offers the jump instead of yanking them down.
  const messageCount = current?.messages.length ?? 0;
  const [pinned, setPinned] = useState(true);
  const [countWhenLeft, setCountWhenLeft] = useState(0);
  const firstScroll = useRef(true);
  useEffect(() => {
    const thread = threadRef.current;
    if (!thread || !pinned) return;
    thread.scrollTo({ top: thread.scrollHeight, behavior: firstScroll.current ? "instant" : "smooth" });
    if (messageCount) firstScroll.current = false;
  }, [messageCount, pinned]);

  function onThreadScroll(event: React.UIEvent<HTMLDivElement>) {
    const thread = event.currentTarget;
    const atBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 48;
    if (atBottom !== pinned) {
      setPinned(atBottom);
      if (!atBottom) setCountWhenLeft(messageCount);
    }
  }

  function jumpToLatest() {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
    setPinned(true);
  }

  if (failure?.status === "missing")
    return <Empty title="Ticket not found" detail="It may have been removed, or it belongs to someone else." />;
  if (failure?.status === "error")
    return <Empty title="Couldn’t load this ticket" detail={failure.message ?? "Check your connection and try again."} />;
  if (!current) return <Empty title="Opening ticket…" detail="" loading />;

  const { ticket, messages, isStaff, isDeveloper = false, isOwner, staff = [] } = current;
  const finished = ticket.status === "resolved" || ticket.status === "closed";
  const assignee = staff.find((member) => member.id === ticket.assigned_to);

  function patchLocal(patch: Partial<TicketDetail>) {
    setDetail((previous) =>
      previous && previous.id === ticketId
        ? { id: ticketId, data: { ...previous.data, ticket: { ...previous.data.ticket, ...patch } } }
        : previous,
    );
    onChangeRef.current?.({ id: ticketId, ...patch });
  }

  async function update(body: Record<string, unknown>) {
    setActionError("");
    const response = await fetch(`/api/support/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as { ticket?: Partial<TicketDetail>; error?: string };
    if (!response.ok || !result.ticket) return setActionError(result.error ?? "Couldn’t save that change.");
    patchLocal(result.ticket);
  }

  async function sendReply(event?: React.FormEvent) {
    event?.preventDefault();
    const body = reply.trim();
    if (!body || sending) return;
    setSending(true);
    setActionError("");
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, internal }),
      });
      const result = (await response.json()) as { message?: TicketMessage; status?: TicketStatus; error?: string };
      if (!response.ok || !result.message) throw new Error(result.error ?? "Couldn’t send your reply.");
      const message = result.message;
      lastAt.current = message.created_at;
      setDetail((previous) =>
        previous && previous.id === ticketId
          ? {
              id: ticketId,
              data: {
                ...previous.data,
                messages: previous.data.messages.some((item) => item.id === message.id)
                  ? previous.data.messages
                  : [...previous.data.messages, message],
              },
            }
          : previous,
      );
      patchLocal({ status: result.status ?? ticket.status, updated_at: message.created_at });
      setReply("");
      setPinned(true);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Couldn’t send your reply.");
    } finally {
      setSending(false);
    }
  }

  const panel = variant === "panel";

  return (
    <div className={panel ? "flex h-full min-h-0 flex-col" : ""}>
      {/* Header */}
      <div className={`border-b border-line ${panel ? "px-5 py-4" : "px-4 py-5 sm:px-6"}`}>
        <div className="flex flex-wrap items-start gap-3.5">
          <TypeIcon type={ticket.type} size={panel ? 38 : 44} />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[12px] text-faint">
              #{ticket.number} · {TYPE_LABELS[ticket.type]}
              {ticket.severity ? ` · ${SEVERITY_LABELS[ticket.severity]}` : ""}
            </p>
            <h1
              className={`mt-0.5 font-display font-bold leading-tight tracking-[-0.025em] ${panel ? "text-[19px]" : "text-[24px] sm:text-[28px]"}`}
            >
              {ticket.title}
            </h1>
            <p className="mt-1 text-[12.5px] text-muted">
              {isStaff ? `${ticket.reporter_name ?? ticket.reporter_email} · ` : ""}
              Opened {timeAgo(ticket.created_at, now)} · updated {timeAgo(ticket.updated_at, now)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {panel ? (
              <Link
                href={`/support/${ticket.id}`}
                aria-label="Open ticket in full page"
                className="grid h-9 w-9 place-items-center rounded-xl border border-line text-muted transition hover:border-line-strong hover:text-ink"
              >
                <ExternalLink size={14} />
              </Link>
            ) : null}
            {!isStaff ? <StatusBadge status={ticket.status} /> : null}
            {isOwner && !isStaff ? (
              <button
                type="button"
                onClick={() => void update({ status: finished ? "open" : "closed" })}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line-strong px-3 text-[13px] font-semibold text-ink-2 transition hover:border-ink/40 hover:text-ink"
              >
                {finished ? <RotateCcw size={14} /> : <XCircle size={14} />}
                {finished ? "Reopen" : "Close ticket"}
              </button>
            ) : null}
          </div>
        </div>

        {/* Triage bar */}
        {isStaff ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Control label="Status">
              <Dropdown
                chevron
                aria-label="Status"
                value={ticket.status}
                onChange={(value) => void update({ status: value })}
                className="h-9 min-w-[140px] rounded-xl border border-line-strong bg-surface px-3 text-[13px] font-semibold"
              >
                {TICKET_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </Dropdown>
            </Control>
            <Control label="Severity">
              <Dropdown
                chevron
                aria-label="Severity"
                value={ticket.severity ?? ""}
                onChange={(value) => void update({ severity: value || null })}
                className="h-9 min-w-[150px] rounded-xl border border-line-strong bg-surface px-3 text-[13px] font-semibold"
              >
                <option value="">Not set</option>
                {SEVERITIES.map((severity) => (
                  <option key={severity} value={severity}>
                    {SEVERITY_LABELS[severity]}
                  </option>
                ))}
              </Dropdown>
            </Control>
            <Control label="Assignee">
              <Dropdown
                chevron
                aria-label="Assignee"
                value={ticket.assigned_to ?? ""}
                onChange={(value) => void update({ assignedTo: value || null })}
                className="h-9 min-w-[160px] rounded-xl border border-line-strong bg-surface px-3 text-[13px] font-semibold"
              >
                <option value="">Unassigned</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Dropdown>
            </Control>
            {isDeveloper && ticket.type !== "other" ? (
              <button
                type="button"
                onClick={() => setChangelogOpen(true)}
                className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl border border-line-strong px-3 text-[13px] font-semibold text-ink-2 transition hover:border-ink/40 hover:text-ink"
              >
                <Newspaper size={14} /> Add to changelog
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={panel ? "grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_240px]" : "grid lg:grid-cols-[minmax(0,1fr)_280px]"}>
        {/* Thread */}
        <div className={`relative flex min-h-0 min-w-0 flex-col border-line ${panel ? "xl:border-r" : "lg:border-r"}`}>
          <div
            ref={threadRef}
            onScroll={onThreadScroll}
            className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 ${panel ? "" : "h-[min(62vh,640px)]"}`}
          >
            <div className="flex flex-col gap-1 py-5">
              <DayDivider iso={ticket.created_at} />
              <ChatRow
                mine={isOwner}
                avatar={ticket.reporter_avatar}
                name={isOwner ? "You" : (ticket.reporter_name ?? ticket.reporter_email)}
                seed={ticket.reporter_email}
                time={ticket.created_at}
                now={now}
                badge="Reported"
              >
                {ticket.description}
              </ChatRow>
              {messages.map((message, index) => {
                const previous = index === 0 ? null : messages[index - 1];
                const newDay =
                  new Date(message.created_at).toDateString() !==
                  new Date(previous?.created_at ?? ticket.created_at).toDateString();
                return (
                  <div key={message.id}>
                    {newDay ? <DayDivider iso={message.created_at} /> : null}
                    <ChatRow
                      mine={message.mine}
                      avatar={message.author_avatar}
                      name={message.mine ? "You" : (message.author_name ?? "Someone")}
                      seed={message.author_name ?? message.id}
                      time={message.created_at}
                      now={now}
                      staff={message.is_staff}
                      internal={message.is_internal}
                    >
                      {message.body}
                    </ChatRow>
                  </div>
                );
              })}
              {messages.length === 0 ? (
                <p className="py-6 text-center text-[12.5px] text-faint">
                  {isStaff ? "No replies yet — say hello to the reporter." : "The team will reply right here. You’ll get an email too."}
                </p>
              ) : null}
            </div>
          </div>

          <AnimatePresence>
            {!pinned && messageCount > countWhenLeft ? (
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                onClick={jumpToLatest}
                className="absolute bottom-[132px] left-1/2 z-10 -translate-x-1/2 rounded-full bg-ink px-3.5 py-1.5 text-[12px] font-semibold text-page shadow-lg"
              >
                New messages ↓
              </motion.button>
            ) : null}
          </AnimatePresence>

          {/* Composer */}
          <form onSubmit={sendReply} className="border-t border-line px-4 py-3 sm:px-6">
            {isStaff ? (
              <div className="mb-2 flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={internal}
                  onClick={() => setInternal((value) => !value)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold transition ${
                    internal
                      ? "bg-[color-mix(in_srgb,#f59e0b_18%,transparent)] text-[#b45309] dark:text-[#fcd34d]"
                      : "bg-sunken text-muted hover:text-ink"
                  }`}
                >
                  <span
                    className={`relative h-3.5 w-6 rounded-full transition ${internal ? "bg-[#f59e0b]" : "bg-line-strong"}`}
                  >
                    <span
                      className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all ${internal ? "left-3" : "left-0.5"}`}
                    />
                  </span>
                  <Lock size={11} /> Internal note
                </button>
                <span className="text-[11.5px] text-faint">
                  {internal ? "Only the support team sees this." : "Sent to the reporter by email too."}
                </span>
              </div>
            ) : null}
            <label htmlFor={`reply-${ticketId}`} className="sr-only">
              {internal ? "Internal note" : "Message"}
            </label>
            <div
              className={`flex items-end gap-2 rounded-[22px] border py-1.5 pl-4 pr-1.5 transition focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--ink)_7%,transparent)] ${
                internal
                  ? "border-[color-mix(in_srgb,#f59e0b_55%,var(--line))] bg-[color-mix(in_srgb,#f59e0b_6%,var(--surface))]"
                  : "border-line-strong bg-surface focus-within:border-ink/50"
              }`}
            >
              <textarea
                id={`reply-${ticketId}`}
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void sendReply();
                  }
                }}
                rows={1}
                maxLength={LIMITS.messageMax}
                placeholder={
                  internal
                    ? "Write a note for the team…"
                    : finished && !isStaff
                      ? "Reply to reopen this ticket…"
                      : "Write a message…"
                }
                className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[14px] leading-5 outline-none [field-sizing:content] placeholder:text-faint"
              />
              <button
                type="submit"
                aria-label={internal ? "Add note" : "Send message"}
                disabled={!reply.trim() || sending}
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35 ${
                  internal ? "bg-[#d97706] text-white" : "bg-ink text-page"
                }`}
              >
                {sending ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <ArrowUp size={17} strokeWidth={2.4} />
                )}
              </button>
            </div>
            <p className="mt-1.5 px-1 text-[11px] text-faint">Enter to send · Shift + Enter for a new line · updates live</p>
            <AnimatePresence>
              {actionError ? (
                <div className="mt-2">
                  <FormBanner tone="error">{actionError}</FormBanner>
                </div>
              ) : null}
            </AnimatePresence>
          </form>
        </div>

        {/* Details */}
        <aside
          className={
            panel
              ? "hidden overflow-y-auto px-4 py-4 xl:block"
              : "border-t border-line px-4 py-5 sm:px-6 lg:border-t-0"
          }
        >
          <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">Details</h2>
          <dl className="mt-3 space-y-3 text-[13px]">
            <Row label="Status">
              <StatusBadge status={ticket.status} />
            </Row>
            <Row label="Type">{TYPE_LABELS[ticket.type]}</Row>
            {isStaff ? (
              <Row label="Assignee">
                <span className="inline-flex items-center gap-1.5">
                  {assignee ? (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-ink text-[9.5px] font-bold text-page">
                      {initials(assignee.name)}
                    </span>
                  ) : (
                    <UserRound size={13} className="text-faint" />
                  )}
                  {assignee?.name ?? "Unassigned"}
                </span>
              </Row>
            ) : null}
            {ticket.page_url ? (
              <Row label="Reported from" icon={<Globe size={12} />}>
                <Link href={ticket.page_url} className="break-all font-mono text-[12px] hover:underline">
                  {ticket.page_url}
                </Link>
              </Row>
            ) : null}
            {isStaff ? (
              <>
                <Row label="Reporter">
                  <span className="break-all">
                    {ticket.reporter_name ? `${ticket.reporter_name} · ` : ""}
                    {ticket.reporter_email}
                    {ticket.reporter_role ? (
                      <span className="text-muted"> · {ticket.reporter_role.replace("_", " ")}</span>
                    ) : null}
                  </span>
                </Row>
                {ticket.user_agent ? (
                  <Row label="Browser" icon={<Monitor size={12} />}>
                    <span className="break-words text-[12px] text-ink-2">{ticket.user_agent}</span>
                  </Row>
                ) : null}
              </>
            ) : null}
          </dl>
        </aside>
      </div>

      {isDeveloper ? (
        <ChangelogDialog
          open={changelogOpen}
          onClose={() => setChangelogOpen(false)}
          ticket={ticket}
        />
      ) : null}
    </div>
  );
}

function DayDivider({ iso }: { iso: string }) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const label =
    date.toDateString() === today.toDateString()
      ? "Today"
      : date.toDateString() === yesterday.toDateString()
        ? "Yesterday"
        : date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
  return (
    <div className="my-3 flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** One chat message: avatar on the outside edge, name above, time below. */
function ChatRow({
  mine,
  avatar,
  name,
  seed,
  time,
  now,
  staff = false,
  internal = false,
  badge,
  children,
}: {
  mine: boolean;
  avatar?: string | null;
  name: string;
  seed: string;
  time: string;
  now: number;
  staff?: boolean;
  internal?: boolean;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`my-1.5 flex items-end gap-2.5 ${mine ? "flex-row-reverse" : ""}`}
    >
      <Avatar src={avatar} name={name === "You" ? seed : name} seed={seed} size={32} />
      <div className={`flex min-w-0 max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
        <span className="mb-1 flex items-center gap-1.5 px-1 text-[11.5px] font-semibold text-muted">
          {internal ? <Lock size={11} className="text-[#b45309]" /> : staff && !mine ? <ShieldCheck size={12} className="text-action" /> : null}
          {name}
          {internal ? (
            <span className="rounded-full bg-[color-mix(in_srgb,#f59e0b_18%,transparent)] px-1.5 py-px text-[10px] text-[#b45309] dark:text-[#fcd34d]">
              Internal
            </span>
          ) : staff && !mine ? (
            <span className="rounded-full bg-[color-mix(in_srgb,var(--action)_12%,transparent)] px-1.5 py-px text-[10px] text-action">
              Support
            </span>
          ) : badge ? (
            <span className="rounded-full bg-sunken px-1.5 py-px text-[10px] text-muted">{badge}</span>
          ) : null}
        </span>
        <div
          className={`whitespace-pre-wrap break-words rounded-[20px] px-4 py-2.5 text-[14px] leading-6 ${
            internal
              ? "border border-dashed border-[color-mix(in_srgb,#f59e0b_55%,var(--line))] bg-[color-mix(in_srgb,#f59e0b_9%,var(--surface))] text-ink"
              : mine
                ? "rounded-br-md bg-ink text-page"
                : staff
                  ? "rounded-bl-md bg-[color-mix(in_srgb,var(--action)_9%,var(--surface))] text-ink ring-1 ring-[color-mix(in_srgb,var(--action)_22%,transparent)]"
                  : "rounded-bl-md bg-sunken text-ink"
          }`}
        >
          {children}
        </div>
        <time dateTime={time} className="mt-1 px-1 text-[10.5px] text-faint" title={new Date(time).toLocaleString()}>
          {new Date(time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · {timeAgo(time, now)}
        </time>
      </div>
    </motion.div>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-faint">{label}</span>
      {children}
    </span>
  );
}

function Row({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-muted">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 font-medium">{children}</dd>
    </div>
  );
}

function Empty({ title, detail, loading = false }: { title: string; detail: string; loading?: boolean }) {
  return (
    <div className="grid h-full min-h-[320px] place-items-center px-6 py-16 text-center">
      <div>
        {loading ? (
          <span className="mx-auto mb-3 block h-5 w-5 animate-spin rounded-full border-2 border-line-strong border-t-ink" />
        ) : null}
        <p className="font-display text-[16px] font-bold">{title}</p>
        {detail ? <p className="mt-1 text-[13px] text-muted">{detail}</p> : null}
      </div>
    </div>
  );
}

/* ─── Add to changelog ──────────────────────────────────────────────────── */

function ChangelogDialog({
  open,
  onClose,
  ticket,
}: {
  open: boolean;
  onClose: () => void;
  ticket: TicketDetail;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      eyebrow={`Ticket #${ticket.number}`}
      title="Add to changelog"
      description="Write it the way users will read it on the What’s new page."
    >
      {open ? <ChangelogForm ticket={ticket} onClose={onClose} /> : null}
    </Dialog>
  );
}

function ChangelogForm({ ticket, onClose }: { ticket: TicketDetail; onClose: () => void }) {
  const [kind, setKind] = useState<ChangelogKind>(ticket.type === "feature" ? "feature" : "fix");
  const [title, setTitle] = useState(
    ticket.type === "bug" ? `Fixed: ${ticket.title}` : ticket.title,
  );
  const [body, setBody] = useState("");
  const [publish, setPublish] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/changelog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, title, body, ticketId: ticket.id, publish }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Couldn’t add it.");
      setDone(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Couldn’t add it.");
    } finally {
      setPending(false);
    }
  }

  if (done)
    return (
      <div className="flex flex-col items-center px-6 pb-8 pt-2 text-center">
        <p className="font-display text-[18px] font-bold">{publish ? "Published to What’s new" : "Saved as a draft"}</p>
        <p className="mt-1 text-[13.5px] text-muted">
          {publish ? "Everyone can see it on the What’s new page." : "Publish it from the What’s new page when it ships."}
        </p>
        <div className="mt-5 flex gap-2.5">
          <GhostButton onClick={onClose}>Done</GhostButton>
          <Link
            href="/changelog"
            className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-page transition hover:opacity-90"
          >
            Open What’s new
          </Link>
        </div>
      </div>
    );

  return (
    <form onSubmit={save} className="flex flex-col gap-5 px-6 pb-6 pt-1">
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
      <TextField label="Title" value={title} onChange={(event) => setTitle(event.target.value)} maxChars={140} />
      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-semibold text-ink-2">Details (optional)</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="What changed for users?"
          className="w-full resize-y rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-[14px] leading-6 outline-none placeholder:text-faint focus:border-ink"
        />
      </label>
      <label className="flex items-center gap-2.5 text-[13.5px]">
        <input
          type="checkbox"
          checked={publish}
          onChange={(event) => setPublish(event.target.checked)}
          className="h-4 w-4 accent-[var(--ink)]"
        />
        Publish now on What’s new
      </label>
      <AnimatePresence>{error ? <FormBanner tone="error">{error}</FormBanner> : null}</AnimatePresence>
      <div className="flex justify-end gap-2.5">
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <SubmitButton pending={pending} pendingLabel="Saving">
          {publish ? "Publish" : "Save draft"}
        </SubmitButton>
      </div>
    </form>
  );
}
