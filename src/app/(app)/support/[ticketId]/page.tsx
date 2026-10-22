"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Globe, Monitor, RotateCcw, Send, ShieldCheck, XCircle } from "lucide-react";
import {
  LIMITS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  TICKET_STATUSES,
  TYPE_LABELS,
  type Ticket,
  type TicketMessage,
  type TicketStatus,
} from "@/lib/support";
import { PageState } from "@/components/ui/skeleton";
import { Frame, Page } from "@/components/ui/frame";
import { Dropdown } from "@/components/ui/dropdown";
import { FormBanner } from "@/components/ui/form";
import { StatusBadge, TypeIcon, timeAgo, useNow } from "@/components/support/kit";

type Detail = {
  ticket: Ticket & { user_agent: string | null };
  messages: TicketMessage[];
  isStaff: boolean;
  isOwner: boolean;
};

type LoadState =
  | { status: "loading"; id: string }
  | { status: "ready"; id: string; data: Detail }
  | { status: "missing"; id: string }
  | { status: "error"; id: string; message: string };

export default function TicketPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const now = useNow();
  const [state, setState] = useState<LoadState>({ status: "loading", id: ticketId });
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState("");
  const threadEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/support/tickets/${ticketId}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) return setState({ status: "missing", id: ticketId });
        const data = (await response.json()) as Detail & { error?: string };
        if (!response.ok)
          return setState({ status: "error", id: ticketId, message: data.error ?? "Couldn't load this ticket." });
        setState({ status: "ready", id: ticketId, data });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error", id: ticketId, message: "Couldn't load this ticket." });
      });
    return () => controller.abort();
  }, [ticketId]);

  const current = state.id === ticketId ? state : ({ status: "loading", id: ticketId } as const);
  if (current.status === "loading") return <PageState message="Opening ticket" loading />;
  if (current.status === "missing")
    return (
      <PageState
        message="Ticket not found"
        detail="It may have been removed, or it belongs to someone else."
      />
    );
  if (current.status === "error") return <PageState message="Couldn’t load ticket" detail={current.message} />;

  const { ticket, messages, isStaff, isOwner } = current.data;
  const update = (patch: Partial<Detail>) =>
    setState({ status: "ready", id: ticketId, data: { ...current.data, ...patch } });

  async function setStatus(status: TicketStatus) {
    setActionError("");
    const response = await fetch(`/api/support/tickets/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const result = (await response.json()) as { ticket?: { status: TicketStatus; updated_at: string }; error?: string };
    if (!response.ok || !result.ticket) return setActionError(result.error ?? "Couldn't update the status.");
    update({ ticket: { ...ticket, ...result.ticket } });
  }

  async function sendReply(event: React.FormEvent) {
    event.preventDefault();
    const body = reply.trim();
    if (!body || sending) return;
    setSending(true);
    setActionError("");
    try {
      const response = await fetch(`/api/support/tickets/${ticket.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const result = (await response.json()) as { message?: TicketMessage; status?: TicketStatus; error?: string };
      if (!response.ok || !result.message) throw new Error(result.error ?? "Couldn't send your reply.");
      update({
        messages: [...messages, result.message],
        ticket: { ...ticket, status: result.status ?? ticket.status, updated_at: result.message.created_at },
      });
      setReply("");
      window.requestAnimationFrame(() => threadEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Couldn't send your reply.");
    } finally {
      setSending(false);
    }
  }

  const finished = ticket.status === "resolved" || ticket.status === "closed";

  return (
    <Page>
      <Frame>
        {/* Header */}
        <div className="border-b border-line px-4 py-5 sm:px-6">
          <Link
            href="/support"
            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted hover:text-ink hover:underline"
          >
            <ArrowLeft size={13} /> {isStaff && !isOwner ? "All tickets" : "My tickets"}
          </Link>
          <div className="mt-3 flex flex-wrap items-start gap-4">
            <TypeIcon type={ticket.type} size={44} />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[12px] text-faint">
                #{ticket.number} · {TYPE_LABELS[ticket.type]}
                {ticket.severity ? ` · ${SEVERITY_LABELS[ticket.severity]}` : ""}
              </p>
              <h1 className="mt-1 font-display text-[24px] font-bold leading-tight tracking-[-0.03em] sm:text-[28px]">
                {ticket.title}
              </h1>
              <p className="mt-1.5 text-[13px] text-muted">
                {isStaff ? `${ticket.reporter_name ?? ticket.reporter_email} · ` : ""}
                Opened {timeAgo(ticket.created_at, now)} · updated {timeAgo(ticket.updated_at, now)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isStaff ? (
                <Dropdown
                  chevron
                  aria-label="Ticket status"
                  value={ticket.status}
                  onChange={(value) => void setStatus(value as TicketStatus)}
                  className="h-9 min-w-[150px] rounded-xl border border-line-strong bg-surface px-3 text-[13px] font-semibold"
                >
                  {TICKET_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </Dropdown>
              ) : (
                <StatusBadge status={ticket.status} />
              )}
              {isOwner && !isStaff ? (
                finished ? (
                  <button
                    type="button"
                    onClick={() => void setStatus("open")}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line-strong px-3 text-[13px] font-semibold text-ink-2 transition hover:border-ink/40 hover:text-ink"
                  >
                    <RotateCcw size={14} /> Reopen
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void setStatus("closed")}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line-strong px-3 text-[13px] font-semibold text-ink-2 transition hover:border-ink/40 hover:text-ink"
                  >
                    <XCircle size={14} /> Close ticket
                  </button>
                )
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
          {/* Thread */}
          <div className="min-w-0 border-line px-4 py-5 sm:px-6 lg:border-r">
            <article className="rounded-2xl border border-line bg-surface-2 p-4">
              <p className="text-[12px] font-semibold text-muted">
                {isOwner ? "You" : (ticket.reporter_name ?? ticket.reporter_email)} wrote
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-6 text-ink">
                {ticket.description}
              </p>
            </article>

            <ol className="mt-4 flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.li
                    key={message.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        message.mine
                          ? "rounded-br-md bg-ink text-page"
                          : message.is_staff
                            ? "rounded-bl-md border border-[color-mix(in_srgb,var(--action)_30%,var(--line))] bg-[color-mix(in_srgb,var(--action)_7%,var(--surface))]"
                            : "rounded-bl-md border border-line bg-surface"
                      }`}
                    >
                      <p
                        className={`flex items-center gap-1.5 text-[11.5px] font-semibold ${
                          message.mine ? "text-page/70" : "text-muted"
                        }`}
                      >
                        {message.is_staff ? <ShieldCheck size={12} /> : null}
                        {message.mine ? "You" : (message.author_name ?? "Someone")}
                        {message.is_staff && !message.mine ? " · Support team" : ""}
                        <span aria-hidden="true">·</span>
                        <span className="font-normal">{timeAgo(message.created_at, now)}</span>
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-6">{message.body}</p>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
            {messages.length === 0 ? (
              <p className="mt-4 text-center text-[13px] text-muted">
                {isStaff ? "No replies yet — be the first to respond." : "No replies yet. The team will answer here."}
              </p>
            ) : null}
            <div ref={threadEnd} />

            <form onSubmit={sendReply} className="mt-5">
              <label htmlFor="reply" className="sr-only">
                Reply
              </label>
              <div className="rounded-2xl border border-line-strong bg-surface p-2 transition focus-within:border-ink focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--ink)_8%,transparent)]">
                <textarea
                  id="reply"
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) sendReply(event);
                  }}
                  rows={3}
                  maxLength={LIMITS.messageMax}
                  placeholder={
                    finished && !isStaff
                      ? "Replying reopens this ticket…"
                      : isStaff
                        ? "Reply to the reporter…"
                        : "Add more detail or reply to the team…"
                  }
                  className="block w-full resize-y bg-transparent px-2 py-1.5 text-[14px] leading-6 outline-none placeholder:text-faint"
                />
                <div className="flex items-center justify-between gap-3 px-2 pb-1 pt-1.5">
                  <span className="text-[11.5px] text-faint">Ctrl + Enter to send</span>
                  <button
                    type="submit"
                    disabled={!reply.trim() || sending}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-[13px] font-semibold text-page transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Send size={14} /> {sending ? "Sending" : "Send"}
                  </button>
                </div>
              </div>
            </form>
            <AnimatePresence>
              {actionError ? (
                <div className="mt-3">
                  <FormBanner tone="error">{actionError}</FormBanner>
                </div>
              ) : null}
            </AnimatePresence>
          </div>

          {/* Context */}
          <aside className="border-t border-line px-4 py-5 sm:px-6 lg:border-t-0">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">Details</h2>
            <dl className="mt-3 space-y-3 text-[13px]">
              <div>
                <dt className="text-muted">Status</dt>
                <dd className="mt-1">
                  <StatusBadge status={ticket.status} />
                </dd>
              </div>
              <div>
                <dt className="text-muted">Type</dt>
                <dd className="mt-0.5 font-medium">{TYPE_LABELS[ticket.type]}</dd>
              </div>
              {ticket.page_url ? (
                <div>
                  <dt className="flex items-center gap-1.5 text-muted">
                    <Globe size={12} /> Reported from
                  </dt>
                  <dd className="mt-0.5 break-all font-mono text-[12px]">
                    <Link href={ticket.page_url} className="hover:underline">
                      {ticket.page_url}
                    </Link>
                  </dd>
                </div>
              ) : null}
              {isStaff ? (
                <>
                  <div>
                    <dt className="text-muted">Reporter</dt>
                    <dd className="mt-0.5 break-all font-medium">
                      {ticket.reporter_name ? `${ticket.reporter_name} · ` : ""}
                      {ticket.reporter_email}
                      {ticket.reporter_role ? (
                        <span className="text-muted"> · {ticket.reporter_role.replace("_", " ")}</span>
                      ) : null}
                    </dd>
                  </div>
                  {ticket.user_agent ? (
                    <div>
                      <dt className="flex items-center gap-1.5 text-muted">
                        <Monitor size={12} /> Browser
                      </dt>
                      <dd className="mt-0.5 break-words text-[12px] text-ink-2">{ticket.user_agent}</dd>
                    </div>
                  ) : null}
                </>
              ) : null}
            </dl>
          </aside>
        </div>
      </Frame>
    </Page>
  );
}
