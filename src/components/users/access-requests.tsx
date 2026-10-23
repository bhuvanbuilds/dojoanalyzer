"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Inbox, X } from "lucide-react";
import { roleLabel, type AccessRequest } from "@/lib/access-requests";
import { Dropdown } from "@/components/ui/dropdown";
import { FormBanner } from "@/components/ui/form";

type University = { id: string; name: string };
type Squad = { id: string; squad_number: string };

const GRANT_OPTIONS: Array<[string, string]> = [
  ["student", "Student"],
  ["mentor", "Mentor"],
  ["campus_manager", "Campus Manager"],
  ["super_admin", "Super Admin"],
];

function ago(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 60) return `${minutes || 1}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

/** Pending access requests, approved or rejected right here. */
export function AccessRequestsPanel({ onDecided }: { onDecided?: () => void }) {
  const [requests, setRequests] = useState<AccessRequest[] | null>(null);
  const [universities, setUniversities] = useState<University[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/access-requests?scope=all&status=pending", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/super-admin/universities").then((response) => response.json()),
    ])
      .then(([pending, unis]: [{ requests?: AccessRequest[]; error?: string }, { universities?: University[] }]) => {
        if (!active) return;
        if (pending.error) setError(pending.error);
        setRequests(pending.requests ?? []);
        setUniversities(unis.universities ?? []);
      })
      .catch(() => active && setError("Couldn’t load access requests."));
    return () => {
      active = false;
    };
  }, []);

  if (!requests) return null;
  if (requests.length === 0 && !error) return null;

  return (
    <section className="border-b border-line">
      <header className="flex items-center gap-2 bg-[color-mix(in_srgb,#f59e0b_8%,var(--surface))] px-4 py-3 sm:px-5">
        <Inbox size={15} className="text-[#b45309] dark:text-[#fcd34d]" />
        <h2 className="text-[13.5px] font-semibold">
          Access requests
          <span className="ml-1.5 rounded-full bg-[#f59e0b] px-1.5 py-px text-[11px] font-bold text-white">
            {requests.length}
          </span>
        </h2>
        <span className="text-[12.5px] text-muted">People who signed in and are waiting for access</span>
      </header>
      {error ? (
        <div className="px-4 py-3 sm:px-5">
          <FormBanner tone="error">{error}</FormBanner>
        </div>
      ) : null}
      <ul className="divide-y divide-line">
        <AnimatePresence initial={false}>
          {requests.map((request) => (
            <motion.li
              key={request.id}
              layout
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <RequestRow
                request={request}
                universities={universities}
                onDone={() => {
                  setRequests((list) => (list ?? []).filter((item) => item.id !== request.id));
                  onDecided?.();
                }}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}

function RequestRow({
  request,
  universities,
  onDone,
}: {
  request: AccessRequest;
  universities: University[];
  onDone: () => void;
}) {
  const [role, setRole] = useState<string>(
    request.requested_role === "other" ? "mentor" : request.requested_role,
  );
  const [universityId, setUniversityId] = useState(request.university_id ?? universities[0]?.id ?? "");
  const [squads, setSquads] = useState<Squad[]>([]);
  const [squadIds, setSquadIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");
  const universityLabel =
    universities.find((item) => item.id === request.university_id)?.name ?? request.university_name ?? "—";

  useEffect(() => {
    if (role !== "mentor" || !universityId) return;
    let active = true;
    fetch(`/api/squads?university_id=${encodeURIComponent(universityId)}`)
      .then((response) => response.json())
      .then((result: { squads?: Squad[] }) => {
        if (!active) return;
        const list = result.squads ?? [];
        setSquads(list);
        // Preselect the squad they mentioned, when it exists.
        const asked = list.find((squad) => squad.squad_number === request.squad_number);
        if (asked) setSquadIds((current) => (current.length ? current : [asked.id]));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [role, universityId, request.squad_number]);

  async function decide(decision: "approve" | "reject") {
    setBusy(decision);
    setError("");
    try {
      const response = await fetch(`/api/access-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, role, universityId, squadIds, note }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Couldn’t save the decision.");
      onDone();
    } catch (decideError) {
      setError(decideError instanceof Error ? decideError.message : "Couldn’t save the decision.");
      setBusy(null);
    }
  }

  const global = role === "super_admin";

  return (
    <div className="grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="min-w-0">
        <p className="font-display text-[15px] font-semibold">{request.full_name}</p>
        <p className="truncate text-[12.5px] text-muted">{request.email}</p>
        <p className="mt-2 text-[13px] text-ink-2">
          Asked to be <span className="font-semibold">{roleLabel(request)}</span> at{" "}
          <span className="font-semibold">{universityLabel}</span>
          {request.squad_number ? <> · Squad {request.squad_number}</> : null}
        </p>
        {request.details ? (
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-surface-2 px-3 py-2 text-[13px] leading-5 text-ink-2">
            {request.details}
          </p>
        ) : null}
        <p className="mt-2 text-[11.5px] text-faint">{ago(request.created_at)}</p>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="grid gap-2 sm:grid-cols-2">
          <Dropdown
            chevron
            aria-label="Grant role"
            value={role}
            onChange={setRole}
            className="h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-[13px]"
          >
            {GRANT_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Dropdown>
          {!global ? (
            <Dropdown
              chevron
              aria-label="University"
              value={universityId}
              onChange={setUniversityId}
              className="h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-[13px]"
            >
              {universities.map((university) => (
                <option key={university.id} value={university.id}>
                  {university.name}
                </option>
              ))}
            </Dropdown>
          ) : null}
        </div>
        {role === "mentor" && squads.length ? (
          <div className="flex flex-wrap gap-1.5">
            {squads.map((squad) => {
              const on = squadIds.includes(squad.id);
              return (
                <button
                  key={squad.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setSquadIds((current) => (on ? current.filter((id) => id !== squad.id) : [...current, squad.id]))
                  }
                  className={`rounded-md border px-2.5 py-1 text-[12.5px] transition ${
                    on ? "border-ink bg-ink text-page" : "border-line-strong text-ink-2 hover:border-ink/40"
                  }`}
                >
                  Squad {squad.squad_number}
                </button>
              );
            })}
          </div>
        ) : null}
        {role === "student" ? (
          <p className="text-[12px] text-muted">Linked to the student record with this email.</p>
        ) : null}
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          placeholder="Note for their email (optional)"
          aria-label="Note"
          className="h-9 rounded-lg border border-line-strong bg-surface px-3 text-[13px] outline-none placeholder:text-faint focus:border-ink"
        />
        {error ? <FormBanner tone="error">{error}</FormBanner> : null}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void decide("approve")}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3.5 text-[13px] font-semibold text-page transition hover:opacity-90 disabled:opacity-60"
          >
            {busy === "approve" ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Check size={14} />
            )}
            {busy === "approve" ? "Approving…" : "Approve"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void decide("reject")}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong px-3.5 text-[13px] font-semibold text-ink-2 transition hover:border-ink/40 hover:text-ink disabled:opacity-60"
          >
            {busy === "reject" ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <X size={14} />
            )}
            {busy === "reject" ? "Rejecting…" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}
