"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Trash2, UserPlus } from "lucide-react";
import { useCachedProfile } from "@/lib/auth/use-cached-profile";
import { Frame, FrameTitle, Page } from "@/components/ui/frame";
import { Dropdown } from "@/components/ui/dropdown";
import { FormBanner } from "@/components/ui/form";
import { PanelSkeleton } from "@/components/ui/skeleton";

type Squad = { id: string; squad_number: string };
type Mentor = { email: string; full_name: string | null; squad_ids: string[]; status: "active" | "pending" };
type University = { id: string; name: string };

/** Campus managers add mentors to their campus and pick each mentor's squads. */
export default function MentorsPage() {
  const cached = useCachedProfile();
  const isSuperAdmin = cached?.status === "authenticated" && cached.profile.role === "super_admin";
  const [universities, setUniversities] = useState<University[]>([]);
  const [universityId, setUniversityId] = useState("");
  const [mentors, setMentors] = useState<Mentor[] | null>(null);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!isSuperAdmin) return;
    let active = true;
    fetch("/api/super-admin/universities")
      .then((response) => response.json())
      .then((result: { universities?: University[] }) => {
        if (!active) return;
        const list = result.universities ?? [];
        setUniversities(list);
        setUniversityId((current) => current || list[0]?.id || "");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [isSuperAdmin]);

  const query = isSuperAdmin ? (universityId ? `?university_id=${encodeURIComponent(universityId)}` : null) : "";

  const load = useCallback(() => {
    if (query === null) return Promise.resolve();
    return fetch(`/api/campus/mentors${query}`, { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as { mentors?: Mentor[]; squads?: Squad[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Couldn’t load mentors.");
        setMentors(result.mentors ?? []);
        setSquads(result.squads ?? []);
        setError("");
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Couldn’t load mentors."));
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(input: { email: string; fullName: string; squadIds: string[] }) {
    const response = await fetch("/api/campus/mentors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, universityId: isSuperAdmin ? universityId : undefined }),
    });
    const result = (await response.json()) as { status?: string; error?: string };
    if (!response.ok) throw new Error(result.error ?? "Couldn’t save the mentor.");
    await load();
    return result.status;
  }

  async function remove(email: string) {
    const response = await fetch("/api/campus/mentors", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, universityId: isSuperAdmin ? universityId : undefined }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Couldn’t remove the mentor.");
    await load();
  }

  return (
    <Page>
      <Frame>
        <FrameTitle
          eyebrow="Campus team"
          title="Mentors"
          tour="mentors-intro"
          description="Add mentors to your campus and choose the squads each one looks after. Mentors only see their own squads."
          actions={
            isSuperAdmin ? (
              <Dropdown
                chevron
                aria-label="University"
                value={universityId}
                onChange={(value) => {
                  setMentors(null);
                  setUniversityId(value);
                }}
                className="h-9 min-w-[200px] rounded-lg border border-line-strong bg-surface px-3 text-[13px]"
              >
                {universities.map((university) => (
                  <option key={university.id} value={university.id}>
                    {university.name}
                  </option>
                ))}
              </Dropdown>
            ) : null
          }
        />

        <AddMentor
          squads={squads}
          onSave={async (input) => {
            const status = await save(input);
            setNotice(
              status === "pending"
                ? `${input.fullName} is invited. Access starts the first time they sign in with Google.`
                : `${input.fullName} can now sign in as a mentor.`,
            );
          }}
        />

        {notice ? (
          <div className="px-4 py-3 sm:px-5">
            <FormBanner tone="success">{notice}</FormBanner>
          </div>
        ) : null}
        {error ? (
          <div className="px-4 py-3 sm:px-5">
            <FormBanner tone="error">{error}</FormBanner>
          </div>
        ) : null}

        {mentors === null ? (
          <PanelSkeleton rows={4} label="Loading mentors" flat />
        ) : mentors.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13.5px] text-muted sm:px-5">
            No mentors yet. Add one above.
          </p>
        ) : (
          <ul data-tour="mentors-list" className="divide-y divide-line">
            {mentors.map((mentor) => (
              <MentorRow
                key={mentor.email}
                mentor={mentor}
                squads={squads}
                onSave={(squadIds) => save({ email: mentor.email, fullName: mentor.full_name ?? mentor.email, squadIds })}
                onRemove={() => remove(mentor.email)}
              />
            ))}
          </ul>
        )}
      </Frame>
    </Page>
  );
}

function SquadChips({
  squads,
  value,
  onChange,
  disabled,
}: {
  squads: Squad[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  if (!squads.length) return <p className="text-[12.5px] text-muted">This campus has no squads yet.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {squads.map((squad) => {
        const on = value.includes(squad.id);
        return (
          <button
            key={squad.id}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(on ? value.filter((id) => id !== squad.id) : [...value, squad.id])}
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[12.5px] font-medium transition disabled:opacity-60 ${
              on ? "border-ink bg-ink text-page" : "border-line-strong text-ink-2 hover:border-ink/40 hover:text-ink"
            }`}
          >
            {on ? <Check size={12} /> : null}
            Squad {squad.squad_number}
          </button>
        );
      })}
    </div>
  );
}

function AddMentor({
  squads,
  onSave,
}: {
  squads: Squad[];
  onSave: (input: { email: string; fullName: string; squadIds: string[] }) => Promise<void>;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [squadIds, setSquadIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave({ email, fullName, squadIds });
      setFullName("");
      setEmail("");
      setSquadIds([]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Couldn’t save the mentor.");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "h-9 rounded-lg border border-line-strong bg-surface px-3 text-[13.5px] outline-none placeholder:text-faint focus:border-ink";
  return (
    <form data-tour="mentors-add" onSubmit={submit} className="flex flex-col gap-3 px-4 py-4 sm:px-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ink-2">
          Full name
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} required maxLength={120} className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ink-2">
          Google account email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="name@kalvium.community"
            className={input}
          />
        </label>
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[12px] font-medium text-ink-2">Squads they look after</legend>
        <SquadChips squads={squads} value={squadIds} onChange={setSquadIds} disabled={busy} />
      </fieldset>
      {error ? <FormBanner tone="error">{error}</FormBanner> : null}
      <div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-action px-3.5 text-[13px] font-semibold text-white transition hover:bg-action-hover disabled:cursor-wait disabled:opacity-70"
        >
          {busy ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <UserPlus size={14} />
          )}
          {busy ? "Adding…" : "Add mentor"}
        </button>
      </div>
    </form>
  );
}

function MentorRow({
  mentor,
  squads,
  onSave,
  onRemove,
}: {
  mentor: Mentor;
  squads: Squad[];
  onSave: (squadIds: string[]) => Promise<unknown>;
  onRemove: () => Promise<void>;
}) {
  const [squadIds, setSquadIds] = useState(mentor.squad_ids);
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const changed = [...squadIds].sort().join() !== [...mentor.squad_ids].sort().join();

  async function run(kind: "save" | "remove") {
    setBusy(kind);
    setError("");
    try {
      if (kind === "save") await onSave(squadIds);
      else await onRemove();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Something went wrong.");
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  }

  return (
    <li className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)_auto] lg:items-start">
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold text-ink">{mentor.full_name ?? mentor.email}</p>
        <p className="truncate text-[12.5px] text-muted">{mentor.email}</p>
        {mentor.status === "pending" ? (
          <p className="mt-1 text-[11.5px] font-medium text-warning-text">Invited · hasn’t signed in yet</p>
        ) : null}
      </div>
      <SquadChips squads={squads} value={squadIds} onChange={setSquadIds} disabled={busy !== null} />
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        {changed ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void run("save")}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-[12.5px] font-semibold text-page disabled:opacity-60"
          >
            {busy === "save" ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Check size={13} />
            )}
            {busy === "save" ? "Saving…" : "Save squads"}
          </button>
        ) : null}
        {confirming ? (
          <>
            <span className="text-[12px] text-muted">Remove access?</span>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run("remove")}
              className="h-8 rounded-lg bg-action px-3 text-[12.5px] font-semibold text-white disabled:opacity-60"
            >
              {busy === "remove" ? "Removing…" : "Remove"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setConfirming(false)}
              className="h-8 rounded-lg border border-line-strong px-3 text-[12.5px] font-semibold text-ink-2"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`Remove ${mentor.full_name ?? mentor.email}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-[12.5px] font-semibold text-ink-2 transition hover:border-ink/40 hover:text-ink"
          >
            <Trash2 size={13} /> Remove
          </button>
        )}
      </div>
      {error ? (
        <div className="lg:col-span-3">
          <FormBanner tone="error">{error}</FormBanner>
        </div>
      ) : null}
    </li>
  );
}
