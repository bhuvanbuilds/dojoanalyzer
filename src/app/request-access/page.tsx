"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Clock3, LogOut, XCircle } from "lucide-react";
import {
  REQUESTABLE_ROLES,
  REQUEST_ROLE_LABELS,
  roleLabel,
  type AccessRequest,
  type RequestableRole,
} from "@/lib/access-requests";
import { Dropdown } from "@/components/ui/dropdown";
import { FormBanner, SubmitButton, TextField } from "@/components/ui/form";

type Mine = {
  request: AccessRequest | null;
  universities: Array<{ id: string; name: string }>;
  email: string | null;
  hasAccess: boolean;
};

const OTHER_UNIVERSITY = "__other__";
const POLL_MS = 20_000;

export default function RequestAccessPage() {
  const [mine, setMine] = useState<Mine | null>(null);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState(false);

  // Load, then quietly re-check so an approval lets them straight in.
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/access-requests", { cache: "no-store" });
        if (response.status === 401) {
          window.location.replace("/login");
          return;
        }
        const result = (await response.json()) as Mine & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Couldn’t load your request.");
        if (!active) return;
        if (result.hasAccess) {
          window.location.replace("/");
          return;
        }
        setMine(result);
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : "Couldn’t load your request.");
      }
    }
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const request = mine?.request ?? null;
  const showForm = mine && (!request || request.status === "rejected" || editing);

  return (
    <main className="min-h-dvh bg-page px-4 py-10 text-ink sm:py-16">
      <div className="mx-auto w-full max-w-xl">
        <header className="flex items-center justify-between gap-4">
          <Image
            src="/imgs/kalvium_extended_logo.png"
            alt="Kalvium"
            width={2560}
            height={543}
            sizes="120px"
            className="h-6 w-auto"
            priority
          />
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-[13px] font-medium text-ink-2 transition hover:border-ink/40 hover:text-ink"
            >
              <LogOut size={14} /> Sign out
            </button>
          </form>
        </header>

        <div className="mt-10">
          <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.03em]">
            {request?.status === "pending" && !editing ? "Request sent" : "Request access"}
          </h1>
          <p className="mt-2 text-[14.5px] leading-6 text-muted">
            {mine?.email ? (
              <>
                You’re signed in as <span className="font-medium text-ink">{mine.email}</span>, but
                this account doesn’t have access to Dojo Belt Analyzer yet.
              </>
            ) : (
              "This account doesn’t have access to Dojo Belt Analyzer yet."
            )}
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {loadError ? (
            <FormBanner tone="error">{loadError}</FormBanner>
          ) : !mine ? (
            <p className="text-[13.5px] text-muted">Loading…</p>
          ) : showForm ? (
            <RequestForm
              mine={mine}
              existing={editing ? request : null}
              onSaved={(saved) => {
                setMine({ ...mine, request: saved });
                setEditing(false);
              }}
              onCancel={editing ? () => setEditing(false) : undefined}
            />
          ) : request ? (
            <Status request={request} universities={mine.universities} onEdit={() => setEditing(true)} />
          ) : null}
        </div>

        <p className="mt-6 text-center text-[12.5px] text-faint">
          Wrong account? Sign out and continue with the Google account your campus team invited.
        </p>
      </div>
    </main>
  );
}

function Status({
  request,
  universities,
  onEdit,
}: {
  request: AccessRequest;
  universities: Array<{ id: string; name: string }>;
  onEdit: () => void;
}) {
  const university =
    universities.find((item) => item.id === request.university_id)?.name ?? request.university_name ?? "—";
  const pending = request.status === "pending";
  return (
    <div>
      <div className="flex items-start gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
            pending
              ? "bg-[color-mix(in_srgb,#f59e0b_15%,transparent)] text-[#b45309] dark:text-[#fcd34d]"
              : "bg-success-soft text-success-text"
          }`}
        >
          {pending ? <Clock3 size={18} /> : <CheckCircle2 size={18} />}
        </span>
        <div>
          <p className="font-display text-[16px] font-semibold">
            {pending ? "Waiting for an admin" : "Approved"}
          </p>
          <p className="mt-0.5 text-[13.5px] leading-6 text-muted">
            {pending
              ? "We’ll email you when it’s approved, and this page lets you in automatically."
              : "Taking you in…"}
          </p>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-2.5 border-t border-line pt-5 text-[13.5px]">
        <dt className="text-muted">Name</dt>
        <dd className="font-medium">{request.full_name}</dd>
        <dt className="text-muted">Role</dt>
        <dd className="font-medium">{roleLabel(request)}</dd>
        <dt className="text-muted">University</dt>
        <dd className="font-medium">{university}</dd>
        {request.squad_number ? (
          <>
            <dt className="text-muted">Squad</dt>
            <dd className="font-medium">{request.squad_number}</dd>
          </>
        ) : null}
        {request.details ? (
          <>
            <dt className="text-muted">Details</dt>
            <dd className="whitespace-pre-wrap text-ink-2">{request.details}</dd>
          </>
        ) : null}
        <dt className="text-muted">Sent</dt>
        <dd className="text-ink-2">{new Date(request.created_at).toLocaleString()}</dd>
      </dl>
      {pending ? (
        <button
          type="button"
          onClick={onEdit}
          className="mt-5 text-[13px] font-semibold text-ink-2 underline-offset-4 hover:text-ink hover:underline"
        >
          Edit request
        </button>
      ) : null}
    </div>
  );
}

function RequestForm({
  mine,
  existing,
  onSaved,
  onCancel,
}: {
  mine: Mine;
  existing: AccessRequest | null;
  onSaved: (request: AccessRequest) => void;
  onCancel?: () => void;
}) {
  const rejected = mine.request?.status === "rejected" ? mine.request : null;
  const seed = existing ?? rejected;
  const [fullName, setFullName] = useState(seed?.full_name ?? "");
  const [role, setRole] = useState<RequestableRole>(seed?.requested_role ?? "student");
  const [otherRole, setOtherRole] = useState(seed?.other_role ?? "");
  const [universityId, setUniversityId] = useState(
    seed?.university_id ?? (seed?.university_name ? OTHER_UNIVERSITY : (mine.universities[0]?.id ?? OTHER_UNIVERSITY)),
  );
  const [universityName, setUniversityName] = useState(seed?.university_name ?? "");
  const [squadNumber, setSquadNumber] = useState(seed?.squad_number ?? "");
  const [details, setDetails] = useState(seed?.details ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          role,
          otherRole,
          universityId: universityId === OTHER_UNIVERSITY ? null : universityId,
          universityName: universityId === OTHER_UNIVERSITY ? universityName : null,
          squadNumber: role === "student" || role === "mentor" ? squadNumber : null,
          details,
        }),
      });
      const result = (await response.json()) as { request?: AccessRequest; error?: string };
      if (!response.ok || !result.request) throw new Error(result.error ?? "Couldn’t send your request.");
      onSaved(result.request);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Couldn’t send your request.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {rejected && !existing ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-brand-line bg-brand-soft px-3.5 py-3 text-[13px] text-brand-text">
          <XCircle size={15} className="mt-0.5 shrink-0" />
          <span>
            Your last request wasn’t approved{rejected.decision_note ? `: “${rejected.decision_note}”` : "."} You can
            send a new one.
          </span>
        </div>
      ) : null}

      <TextField
        label="Full name"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        placeholder="As your campus knows you"
        autoComplete="name"
        maxChars={120}
        required
      />

      <fieldset>
        <legend className="mb-2 text-[12.5px] font-semibold text-ink-2">I am a…</legend>
        <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {REQUESTABLE_ROLES.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={role === option}
              onClick={() => setRole(option)}
              className={`rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition ${
                role === option ? "border-ink bg-ink text-page" : "border-line-strong text-ink-2 hover:border-ink/40"
              }`}
            >
              {REQUEST_ROLE_LABELS[option]}
            </button>
          ))}
        </div>
      </fieldset>

      {role === "other" ? (
        <TextField
          label="Your role"
          value={otherRole}
          onChange={(event) => setOtherRole(event.target.value)}
          placeholder="e.g. Program coordinator"
          maxChars={80}
        />
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-semibold text-ink-2">University</span>
        <Dropdown
          chevron
          aria-label="University"
          value={universityId}
          onChange={setUniversityId}
          className="h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-[14px]"
        >
          {mine.universities.map((university) => (
            <option key={university.id} value={university.id}>
              {university.name}
            </option>
          ))}
          <option value={OTHER_UNIVERSITY}>My university isn’t listed</option>
        </Dropdown>
      </label>
      {universityId === OTHER_UNIVERSITY ? (
        <TextField
          label="University name"
          value={universityName}
          onChange={(event) => setUniversityName(event.target.value)}
          placeholder="Type your university"
          maxChars={120}
        />
      ) : null}

      {role === "student" || role === "mentor" ? (
        <TextField
          label={role === "mentor" ? "Squad you mentor (optional)" : "Squad number (optional)"}
          value={squadNumber}
          onChange={(event) => setSquadNumber(event.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="e.g. 183"
          inputMode="numeric"
        />
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-semibold text-ink-2">Anything else? (optional)</span>
        <textarea
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Who you are, why you need access, who to check with…"
          className="w-full resize-y rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-[14px] leading-6 outline-none placeholder:text-faint focus:border-ink"
        />
      </label>

      <AnimatePresence>
        {error ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <FormBanner tone="error">{error}</FormBanner>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex justify-end gap-2.5">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-line-strong px-4 py-2.5 text-[13.5px] font-semibold text-ink-2 transition hover:border-ink/40"
          >
            Cancel
          </button>
        ) : null}
        <SubmitButton pending={pending} pendingLabel="Sending">
          {existing ? "Update request" : "Send request"}
        </SubmitButton>
      </div>
    </form>
  );
}
