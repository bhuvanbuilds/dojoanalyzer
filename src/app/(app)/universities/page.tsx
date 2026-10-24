"use client";

import { Fragment, useEffect, useState } from "react";
import { Building2, Pencil, Plus, Save, X } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { PanelSkeleton } from "@/components/ui/skeleton";
import { Frame, FrameTitle, Page } from "@/components/ui/frame";

type University = {
  id: string;
  /** Alias when set, otherwise the full name. */
  name: string;
  full_name: string;
  alias: string | null;
  student_count: number;
  squad_count: number;
  mentor_count: number;
  campus_manager_count: number;
};

export default function UniversitiesPage() {
  const [universities, setUniversities] = useState<University[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAlias, setEditAlias] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    squads: Array<{ squad_number: string }>;
    users: Array<{ full_name: string | null; role: string }>;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/super-admin/universities");
    const result = (await response.json()) as {
      universities?: University[];
      error?: string;
    };
    if (!response.ok)
      setMessage(result.error ?? "Unable to load universities.");
    else setUniversities(result.universities ?? []);
    setLoading(false);
  }

  useEffect(() => {
    getCurrentUserProfile().then((profile) => {
      if (
        profile.status !== "authenticated" ||
        profile.profile.role !== "super_admin"
      )
        setMessage("Super Admin access required.");
      else void load();
    });
  }, []);

  async function createUniversity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/super-admin/universities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok)
      setMessage(result.error ?? "Unable to create university.");
    else {
      setName("");
      setMessage("University added.");
      await load();
    }
  }

  async function saveUniversity(id: string) {
    const response = await fetch(`/api/super-admin/universities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, alias: editAlias }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok)
      setMessage(result.error ?? "Unable to update university.");
    else {
      setEditing(null);
      setMessage("University updated.");
      await load();
    }
  }

  async function toggleDetails(id: string) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    const response = await fetch(`/api/super-admin/universities/${id}`);
    const result = (await response.json()) as {
      squads?: Array<{ squad_number: string }>;
      users?: Array<{ full_name: string | null; role: string }>;
      error?: string;
    };
    if (!response.ok) {
      setMessage(result.error ?? "Unable to load university details.");
      return;
    }
    setDetail({ squads: result.squads ?? [], users: result.users ?? [] });
    setExpanded(id);
  }

  return (
    <Page>
      <Frame>
        <FrameTitle
          eyebrow="Global administration"
          title="Universities"
          tour="uni-intro"
          description="Every campus on the platform, with its students, squads and team."
        />
        <form
          data-tour="uni-add"
          onSubmit={createUniversity}
          className="flex flex-wrap items-end gap-3 px-4 py-4 sm:px-5"
        >
          <label className="flex min-w-64 flex-1 flex-col gap-1.5 text-xs font-semibold text-ink-2">
            University name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
            />
          </label>
          <button className="inline-flex items-center gap-2 rounded-lg bg-action-hover px-4 py-2 text-sm font-semibold text-white">
            <Plus size={16} />
            Add university
          </button>
        </form>
        {message && (
          <p className="bg-surface-2 px-4 py-2.5 text-sm text-ink-2 sm:px-5" role="status">
            {message}
          </p>
        )}
        {loading ? (
          <PanelSkeleton rows={6} label="Loading universities" flat />
        ) : (
          <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] lg:divide-x lg:divide-line">
          <div data-tour="uni-table" className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-[11px] uppercase tracking-[0.06em] text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-semibold sm:px-5">University</th>
                  <th className="px-4 py-2.5 font-semibold sm:px-5">Alias</th>
                  <th className="px-4 py-2.5 font-semibold sm:px-5">Students</th>
                  <th className="px-4 py-2.5 font-semibold sm:px-5">Squads</th>
                  <th className="px-4 py-2.5 font-semibold sm:px-5">Mentors</th>
                  <th className="px-4 py-2.5 font-semibold sm:px-5">Campus managers</th>
                  <th className="px-4 py-2.5 font-semibold sm:px-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-surface">
                {universities.map((university) => (
                  <Fragment key={university.id}>
                    <tr className={expanded === university.id ? "bg-sunken/60" : undefined}>
                      <td className="px-4 py-3 font-semibold text-ink sm:px-5">
                        {editing === university.id ? (
                          <input
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            aria-label="Full name"
                            className="w-full rounded-md border border-line-strong bg-surface px-2 py-1"
                          />
                        ) : (
                          university.full_name
                        )}
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        {editing === university.id ? (
                          <input
                            value={editAlias}
                            onChange={(event) => setEditAlias(event.target.value)}
                            maxLength={24}
                            placeholder="e.g. KARE"
                            aria-label="Alias"
                            className="w-24 rounded-md border border-line-strong bg-surface px-2 py-1"
                          />
                        ) : university.alias ? (
                          <span className="rounded-md bg-sunken px-2 py-0.5 text-[12.5px] font-semibold text-ink">
                            {university.alias}
                          </span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 sm:px-5">{university.student_count}</td>
                      <td className="px-4 py-3 sm:px-5">{university.squad_count}</td>
                      <td className="px-4 py-3 sm:px-5">{university.mentor_count}</td>
                      <td className="px-4 py-3 sm:px-5">
                        {university.campus_manager_count}
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <div className="flex items-center gap-2">
                          {editing === university.id ? (
                            <>
                              <button
                                type="button"
                                data-tour="uni-save"
                                title="Save university name"
                                onClick={() => void saveUniversity(university.id)}
                                className="p-2 text-success-text"
                              >
                                <Save size={16} />
                              </button>
                              <button
                                type="button"
                                title="Cancel editing"
                                onClick={() => setEditing(null)}
                                className="p-2 text-muted"
                              >
                                <X size={16} />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              data-tour="uni-rename"
                              title="Edit university name"
                              onClick={() => {
                                setEditing(university.id);
                                setEditName(university.full_name);
                                setEditAlias(university.alias ?? "");
                              }}
                              className="p-2 text-muted"
                            >
                              <Pencil size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            data-tour="uni-details"
                            onClick={() => void toggleDetails(university.id)}
                            className="inline-flex items-center gap-1.5 rounded border border-line-strong px-2.5 py-1.5 text-xs font-semibold"
                          >
                            <Building2 size={14} />
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                ))}
                {!universities.length && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-muted"
                    >
                      No universities found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <aside className="border-t border-line px-4 py-4 sm:px-5 lg:border-t-0">
            {expanded && detail ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Details</p>
                <h2 className="mt-1 text-[15px] font-semibold text-ink">
                  {universities.find((item) => item.id === expanded)?.full_name}
                </h2>
                <div data-tour="uni-squads" className="mt-4">
                  <h3 className="text-[12px] font-semibold text-ink-2">Squads</h3>
                  {detail.squads.length ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {detail.squads.map((squad) => (
                        <span key={squad.squad_number} className="rounded-md bg-sunken px-2 py-0.5 text-[12px] text-ink-2">
                          {squad.squad_number}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-[13px] text-muted">No squads yet</p>
                  )}
                </div>
                <div data-tour="uni-team" className="mt-4">
                  <h3 className="text-[12px] font-semibold text-ink-2">Campus team</h3>
                  {detail.users.length ? (
                    <ul className="mt-1.5 space-y-1.5">
                      {detail.users.map((user, index) => (
                        <li key={`${user.full_name}-${index}`} className="flex items-center justify-between gap-2 text-[13px]">
                          <span className="truncate text-ink">{user.full_name ?? "Unnamed"}</span>
                          <span className="shrink-0 text-[12px] text-muted">
                            {user.role === "mentor" ? "Mentor" : "Campus Manager"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-[13px] text-muted">No assigned mentors or campus managers</p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex h-full min-h-40 flex-col justify-center text-[13px] text-muted">
                <p className="font-medium text-ink-2">No university selected</p>
                <p className="mt-1">Choose Details on a row to see its squads and campus team here.</p>
              </div>
            )}
          </aside>
          </div>
        )}
      </Frame>
    </Page>
  );
}
