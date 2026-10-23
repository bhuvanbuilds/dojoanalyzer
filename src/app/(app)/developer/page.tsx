"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { getCurrentUserProfile, type CurrentUserProfile } from "@/lib/auth/profile";
import type { Ticket as SupportTicket } from "@/lib/support";
import type { ViewAsRole } from "@/lib/view-as";
import { PageState } from "@/components/ui/skeleton";
import { Dropdown } from "@/components/ui/dropdown";
import { FormBanner } from "@/components/ui/form";
import { StatusBadge, timeAgo, useNow } from "@/components/support/kit";

type Status = {
  environment: {
    mode: string;
    deployment: string;
    commit: string | null;
    branch: string | null;
    supabaseProject: string | null;
    siteUrl: string | null;
  };
  checks: {
    database: { ok: boolean; ms: number };
    supportTables: { ok: boolean; error: string | null };
    settingsTable: { ok: boolean; error: string | null };
    email: { ok: boolean; to: string | null };
  };
  counts: Record<"students" | "weeks" | "imports" | "accounts" | "invitations" | "tickets" | "openTickets", number>;
  maintenance: { enabled: boolean; until: string | null };
  latestImport: { file_name: string; uploaded_at: string; status: string } | null;
};
type AuditLog = { actor: string | null; action: string; target_type: string; created_at: string };
type University = { id: string; name: string };
type Student = { id: string; name: string | null; email: string | null };

const ROLES: Array<{ role: ViewAsRole; label: string }> = [
  { role: "campus_manager", label: "Campus manager" },
  { role: "mentor", label: "Mentor" },
  { role: "student", label: "Student" },
];

const MONO = "font-[family-name:var(--font-mono)]";

function humanAction(action: string) {
  return action.replace(/_/g, " ");
}

export default function DeveloperPage() {
  const router = useRouter();
  const now = useNow();
  const [account, setAccount] = useState<CurrentUserProfile | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [statusError, setStatusError] = useState("");
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  const [universities, setUniversities] = useState<University[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [role, setRole] = useState<ViewAsRole>("campus_manager");
  const [universityId, setUniversityId] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [studentId, setStudentId] = useState("");
  const [squadPicks, setSquadPicks] = useState<string[]>([]);
  const [squadList, setSquadList] = useState<Array<{ id: string; squad_number: string }>>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getCurrentUserProfile().then((result) => {
      if (!active) return;
      setAccount(result);
      if (result.status === "unauthenticated") router.replace("/login");
      else if (result.status !== "authenticated" || !result.profile.is_developer) router.replace("/");
    });
    return () => {
      active = false;
    };
  }, [router]);

  const isDeveloper = account?.status === "authenticated" && account.profile.is_developer;

  useEffect(() => {
    if (!isDeveloper) return;
    const json = (url: string) => fetch(url, { cache: "no-store" }).then((response) => response.json());
    fetch("/api/developer/status", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as Status & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Couldn’t load status.");
        setStatus(result);
      })
      .catch((loadError: unknown) =>
        setStatusError(loadError instanceof Error ? loadError.message : "Couldn’t load status."),
      );
    json("/api/super-admin/audit-logs")
      .then((result: { logs?: AuditLog[] }) => setLogs((result.logs ?? []).slice(0, 8)))
      .catch(() => setLogs([]));
    json("/api/support/tickets?scope=all")
      .then((result: { tickets?: SupportTicket[] }) =>
        setTickets(
          (result.tickets ?? []).filter((ticket) => ticket.status === "open" || ticket.status === "in_progress").slice(0, 5),
        ),
      )
      .catch(() => setTickets([]));
    json("/api/super-admin/universities")
      .then((result: { universities?: University[] }) => {
        const list = result.universities ?? [];
        setUniversities(list);
        setUniversityId((current) => current || list[0]?.id || "");
      })
      .catch(() => undefined);
    json("/api/students")
      .then((result: { students?: Student[] }) => setStudents(result.students ?? []))
      .catch(() => undefined);
  }, [isDeveloper]);

  useEffect(() => {
    if (!isDeveloper || role !== "mentor" || !universityId) return;
    let active = true;
    fetch(`/api/squads?university_id=${encodeURIComponent(universityId)}`)
      .then((response) => response.json())
      .then((result: { squads?: Array<{ id: string; squad_number: string }> }) => {
        if (active) setSquadList(result.squads ?? []);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [isDeveloper, role, universityId]);

  const matches = useMemo(() => {
    const term = studentQuery.trim().toLowerCase();
    return students
      .filter(
        (student) =>
          !term ||
          (student.name ?? "").toLowerCase().includes(term) ||
          (student.email ?? "").toLowerCase().includes(term),
      )
      .slice(0, 6);
  }, [students, studentQuery]);

  async function startViewAs() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/developer/view-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, universityId, studentId, squadIds: squadPicks }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Couldn’t switch view.");
      // Full load so every page and cached profile starts as the viewed role.
      window.location.assign(role === "student" ? "/student" : "/");
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : "Couldn’t switch view.");
      setPending(false);
    }
  }

  if (!isDeveloper) return <PageState message="Checking your account" loading />;

  const env = status?.environment;
  const production = env?.deployment === "production";
  const envLabel = !env ? "—" : production ? "Production" : env.deployment === "preview" ? "Preview" : "Local";
  const canStart =
    role === "student"
      ? Boolean(studentId)
      : role === "mentor"
        ? Boolean(universityId) && squadPicks.length > 0
        : Boolean(universityId);

  const services: Array<[string, boolean | undefined, string, string]> = status
    ? [
        ["Database", status.checks.database.ok, status.environment.supabaseProject ?? "—", `${status.checks.database.ms} ms`],
        ["Support tables", status.checks.supportTables.ok, "support_tickets, support_messages", status.checks.supportTables.ok ? "ok" : "missing"],
        ["Settings table", status.checks.settingsTable.ok, "app_settings (maintenance)", status.checks.settingsTable.ok ? "ok" : "missing"],
        ["Email", status.checks.email.ok, status.checks.email.to ?? "RESEND_API_KEY not set", status.checks.email.ok ? "resend" : "off"],
        ["Maintenance", !status.maintenance.enabled, status.maintenance.enabled ? "Only developers can sign in" : "Open to everyone", status.maintenance.enabled ? "on" : "off"],
      ]
    : [];

  const metrics: Array<[string, number | undefined]> = [
    ["Students", status?.counts.students],
    ["Weeks", status?.counts.weeks],
    ["Imports", status?.counts.imports],
    ["Accounts", status?.counts.accounts],
    ["Invites", status?.counts.invitations],
    ["Open tickets", status?.counts.openTickets],
  ];

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <h1 className="font-display text-[22px] font-semibold tracking-[-0.02em]">Developer</h1>
          <p className={`${MONO} mt-1.5 text-[12px] text-muted`}>
            {envLabel.toLowerCase()} · {env?.supabaseProject ?? "—"}
            {env?.branch ? ` · ${env.branch}${env.commit ? `@${env.commit}` : ""}` : ""} · {env?.mode ?? "—"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/settings/maintenance"
            className="rounded-lg border border-line-strong px-3 py-1.5 text-[13px] font-medium text-ink-2 transition hover:border-ink/40 hover:text-ink"
          >
            Maintenance
          </Link>
          <Link
            href="/support/inbox"
            className="rounded-lg bg-ink px-3 py-1.5 text-[13px] font-medium text-page transition hover:opacity-90"
          >
            Tickets{status?.counts.openTickets ? ` (${status.counts.openTickets})` : ""}
          </Link>
        </div>
      </div>

      {statusError ? (
        <div className="mt-5">
          <FormBanner tone="error">{statusError}</FormBanner>
        </div>
      ) : null}

      {/* Metrics strip */}
      <dl className="mt-6 grid grid-cols-3 border-y border-line sm:grid-cols-6">
        {metrics.map(([label, value], index) => (
          <div
            key={label}
            className={`py-4 pr-4 ${index ? "sm:border-l sm:pl-4" : ""} ${index % 3 ? "border-l pl-4" : ""} ${index >= 3 ? "border-t sm:border-t-0" : ""} border-line`}
          >
            <dt className="text-[12px] text-muted">{label}</dt>
            <dd className="mt-1 text-[20px] font-semibold tabular-nums tracking-[-0.02em]">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>

      {/* Services */}
      <section className="mt-8">
        <h2 className="text-[13px] font-semibold">Services</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead className="border-b border-line bg-surface-2 text-[12px] text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Service</th>
                <th className="px-4 py-2 font-medium">Detail</th>
                <th className="px-4 py-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface">
              {!status ? (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-muted">
                    Checking…
                  </td>
                </tr>
              ) : (
                services.map(([name, ok, detail, value]) => (
                  <tr key={name}>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-[#10b981]" : "bg-[#ef3837]"}`} />
                        {name}
                      </span>
                    </td>
                    <td className={`${MONO} px-4 py-2.5 text-[12px] text-muted`}>{detail}</td>
                    <td className={`${MONO} px-4 py-2.5 text-right text-[12px] tabular-nums ${ok ? "text-ink-2" : "text-brand-text"}`}>
                      {value}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className={`${MONO} mt-2 text-[11.5px] text-faint`}>
          {status?.latestImport
            ? `last import ${status.latestImport.file_name} · ${timeAgo(status.latestImport.uploaded_at, now)} · ${status.latestImport.status}`
            : status
              ? "no imports yet"
              : ""}
        </p>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-8">
          {/* Activity */}
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="text-[13px] font-semibold">Recent activity</h2>
              <Link href="/audit-logs" className="text-[12px] text-muted hover:text-ink hover:underline">
                View all
              </Link>
            </div>
            <div className="mt-3 overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[520px] text-left text-[13px]">
                <tbody className="divide-y divide-line bg-surface">
                  {!logs ? (
                    <tr>
                      <td className="px-4 py-4 text-muted">Loading…</td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-muted">Nothing logged yet.</td>
                    </tr>
                  ) : (
                    logs.map((log, index) => (
                      <tr key={`${log.created_at}-${index}`}>
                        <td className={`${MONO} w-24 whitespace-nowrap px-4 py-2.5 text-[12px] text-faint`}>
                          {timeAgo(log.created_at, now)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-medium">{log.actor ?? "System"}</td>
                        <td className="px-4 py-2.5 text-ink-2">{humanAction(log.action)}</td>
                        <td className={`${MONO} px-4 py-2.5 text-right text-[12px] text-muted`}>{log.target_type}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Tickets */}
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="text-[13px] font-semibold">Open tickets</h2>
              <Link href="/support/inbox" className="text-[12px] text-muted hover:text-ink hover:underline">
                Open workspace
              </Link>
            </div>
            <div className="mt-3 overflow-hidden rounded-lg border border-line bg-surface">
              {!tickets ? (
                <p className="px-4 py-4 text-[13px] text-muted">Loading…</p>
              ) : tickets.length === 0 ? (
                <p className="px-4 py-4 text-[13px] text-muted">No open tickets.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {tickets.map((ticket) => (
                    <li key={ticket.id}>
                      <Link
                        href={`/support/inbox?view=all&t=${ticket.id}`}
                        className="flex items-center gap-3 px-4 py-2.5 text-[13px] transition hover:bg-surface-2"
                      >
                        <span className={`${MONO} w-10 text-[12px] text-faint`}>#{ticket.number}</span>
                        <span className="min-w-0 flex-1 truncate font-medium">{ticket.title}</span>
                        <span className="hidden text-[12px] text-muted sm:inline">{ticket.reporter_name ?? ticket.reporter_email}</span>
                        <StatusBadge status={ticket.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        {/* View as */}
        <aside>
          <h2 className="text-[13px] font-semibold">View as</h2>
          <p className="mt-1 text-[12.5px] leading-5 text-muted">
            Browse the app as another role. Read-only until you exit.
          </p>
          <div className="mt-3 flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-ink-2">Role</span>
              <Dropdown
                chevron
                aria-label="Role"
                value={role}
                onChange={(value) => setRole(value as ViewAsRole)}
                className="h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-[13px]"
              >
                {ROLES.map((option) => (
                  <option key={option.role} value={option.role}>
                    {option.label}
                  </option>
                ))}
              </Dropdown>
            </label>

            {role === "student" ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-ink-2">Student</span>
                <div className="rounded-lg border border-line-strong">
                  <label className="relative block border-b border-line">
                    <span className="sr-only">Search students</span>
                    <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                    <input
                      value={studentQuery}
                      onChange={(event) => setStudentQuery(event.target.value)}
                      placeholder="Name or email"
                      className="w-full bg-transparent py-2 pl-8 pr-3 text-[13px] outline-none"
                    />
                  </label>
                  <ul className="max-h-48 overflow-y-auto py-1">
                    {matches.length === 0 ? (
                      <li className="px-3 py-2 text-[12.5px] text-muted">No matches.</li>
                    ) : (
                      matches.map((student) => (
                        <li key={student.id}>
                          <button
                            type="button"
                            onClick={() => setStudentId(student.id)}
                            aria-pressed={studentId === student.id}
                            className={`w-full truncate px-3 py-1.5 text-left text-[13px] transition ${
                              studentId === student.id ? "bg-sunken font-medium text-ink" : "text-ink-2 hover:bg-surface-2"
                            }`}
                          >
                            {student.name ?? student.email}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            ) : (
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-ink-2">University</span>
                <Dropdown
                  chevron
                  aria-label="University"
                  value={universityId}
                  onChange={setUniversityId}
                  className="h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-[13px]"
                >
                  {universities.length === 0 ? <option value="">No universities yet</option> : null}
                  {universities.map((university) => (
                    <option key={university.id} value={university.id}>
                      {university.name}
                    </option>
                  ))}
                </Dropdown>
              </label>
            )}

            {role === "mentor" && universityId ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-ink-2">Squads</span>
                <div className="flex flex-wrap gap-1.5">
                  {squadList.length === 0 ? (
                    <span className="text-[12.5px] text-muted">No squads in this university.</span>
                  ) : (
                    squadList.map((squad) => {
                      const on = squadPicks.includes(squad.id);
                      return (
                        <button
                          key={squad.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            setSquadPicks((current) =>
                              on ? current.filter((id) => id !== squad.id) : [...current, squad.id],
                            )
                          }
                          className={`rounded-md border px-2.5 py-1 text-[12.5px] transition ${
                            on ? "border-ink bg-ink text-page" : "border-line-strong text-ink-2 hover:border-ink/40"
                          }`}
                        >
                          {squad.squad_number}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}

            {error ? <FormBanner tone="error">{error}</FormBanner> : null}

            <button
              type="button"
              disabled={!canStart || pending}
              onClick={() => void startViewAs()}
              className="h-9 rounded-lg bg-ink text-[13px] font-medium text-page transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "Switching…" : "Start viewing"}
            </button>
          </div>

          <h2 className="mt-8 text-[13px] font-semibold">Shortcuts</h2>
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface text-[13px]">
            {(
              [
                ["/users", "Users and roles"],
                ["/audit-logs", "Audit logs"],
                ["/imports", "Imports"],
                ["/changelog", "Changelog"],
                ["/universities", "Universities"],
              ] as Array<[string, string]>
            ).map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="flex items-center justify-between px-4 py-2.5 text-ink-2 transition hover:bg-surface-2 hover:text-ink">
                  {label}
                  <span className={`${MONO} text-[11.5px] text-faint`}>{href}</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
