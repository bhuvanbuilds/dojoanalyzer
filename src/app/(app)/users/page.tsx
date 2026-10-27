"use client";

import { useEffect, useMemo, useState } from "react";
import { AccessRequestsPanel } from "@/components/users/access-requests";
import { Trash2, UserPlus } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { PanelSkeleton } from "@/components/ui/skeleton";
import { Frame, FrameTitle, Page } from "@/components/ui/frame";
import { HoldButton } from "@/components/reactbits/hold-button";
import { DeleteUserDialog } from "@/components/users/delete-user-dialog";
import { MemberList, Pill } from "@/components/ui/member-list";
import { UserFilters } from "@/components/users/user-filters";
import { EMPTY_FILTERS, applyUserFilters, lastActiveLabel, presenceOf, type UserFilterState } from "@/lib/user-filters";
import { Toast, type ToastMessage } from "@/components/ui/toast";
import { Dropdown } from "@/components/ui/dropdown";

type Role = "super_admin" | "developer" | "campus_manager" | "mentor" | "student";
type UserRow = {
  email: string;
  full_name: string | null;
  role: Role;
  university_id: string | null;
  university_name: string | null;
  student_id: string | null;
  student_name: string | null;
  squads?: Array<{ id: string; squad_number: string }>;
  status: "active" | "pending";
  last_seen_at: string | null;
  last_sign_in_at: string | null;
};
type Option = { id: string; name: string | null; email?: string | null };

const labels: Record<Role, string> = {
  super_admin: "Super Admin",
  developer: "Developer",
  campus_manager: "Campus Manager",
  mentor: "Mentor",
  student: "Student",
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [universities, setUniversities] = useState<Option[]>([]);
  const [students, setStudents] = useState<Option[]>([]);
  const [filters, setFilters] = useState<UserFilterState>(EMPTY_FILTERS);
  // Re-evaluated once a minute so "Active now" fades to "Not active".
  const [now, setNow] = useState(() => Date.now());
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("campus_manager");
  const [universityId, setUniversityId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [squadIds, setSquadIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [squadOptions, setSquadOptions] = useState<Array<{ id: string; squad_number: string }>>([]);
  const [myEmail, setMyEmail] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const visibleUsers = useMemo(() => applyUserFilters(users, filters, now), [users, filters, now]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function load() {
    const response = await fetch("/api/super-admin/users");
    const result = (await response.json()) as {
      users?: UserRow[];
      universities?: Option[];
      students?: Option[];
      error?: string;
    };
    if (!response.ok) setMessage(result.error ?? "Unable to load users.");
    else {
      setUsers(result.users ?? []);
      setUniversities(result.universities ?? []);
      setStudents(result.students ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    getCurrentUserProfile().then(async (profile) => {
      if (
        profile.status !== "authenticated" ||
        profile.profile.role !== "super_admin"
      ) {
        setMessage("Super Admin access required.");
        setLoading(false);
      } else {
        setMyEmail(profile.user.email?.toLowerCase() ?? null);
        const response = await fetch("/api/super-admin/users");
        const result = (await response.json()) as {
          users?: UserRow[];
          universities?: Option[];
          students?: Option[];
          error?: string;
        };
        if (!response.ok) setMessage(result.error ?? "Unable to load users.");
        else {
          setUsers(result.users ?? []);
          setUniversities(result.universities ?? []);
          setStudents(result.students ?? []);
        }
        setLoading(false);
      }
    });
  }, []);

  // A mentor is assigned squads from their own university.
  useEffect(() => {
    if (role !== "mentor" || !universityId) return;
    let active = true;
    fetch(`/api/squads?university_id=${encodeURIComponent(universityId)}`)
      .then((response) => response.json())
      .then((result: { squads?: Array<{ id: string; squad_number: string }> }) => {
        if (active) setSquadOptions(result.squads ?? []);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [role, universityId]);

  async function assign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setMessage("");
    setSaving(true);
    try {
      const response = await fetch("/api/super-admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: name,
          email,
          role,
          universityId:
            role === "super_admin" || role === "developer" ? null : universityId || null,
          studentId: role === "student" ? studentId || null : null,
          squadIds: role === "mentor" ? squadIds : [],
        }),
      });
      const result = (await response.json()) as {
        status?: string;
        error?: string;
      };
      if (!response.ok) {
        setMessage(result.error ?? "Unable to assign user.");
        return;
      }
      setMessage(
        result.status === "pending"
          ? "Assignment saved. It will attach when this email first signs in with Google."
          : "User assignment saved.",
      );
      setName("");
      setEmail("");
      setEditingEmail(null);
      setStudentId("");
      setSquadIds([]);
      await load();
    } catch {
      setMessage("Couldn’t reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function editUser(user: UserRow) {
    setName(user.full_name ?? "");
    setEmail(user.email);
    setEditingEmail(user.email);
    setRole(user.role);
    setUniversityId(user.university_id ?? "");
    setStudentId(user.student_id ?? "");
    setSquadIds((user.squads ?? []).map((squad) => squad.id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <Page>
      <Frame>
        <FrameTitle
          eyebrow="Global administration"
          title="Users"
          tour="users-intro"
          description="Assign Google accounts to a role, university or student record."
        />
        <AccessRequestsPanel onDecided={() => void load()} />
        <form
          data-tour="users-assign"
          onSubmit={assign}
          className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-5"
        >
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-2">
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-2">
            Google account email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              readOnly={editingEmail !== null}
              required
              className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm read-only:bg-sunken"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-2">
            Role
            <Dropdown chevron
              value={role}
              onChange={(value) => setRole(value as Role)}
              className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
            >
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Dropdown>
          </label>
          {role !== "super_admin" && role !== "developer" && (
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-2">
              University
              <Dropdown chevron
                value={universityId}
                onChange={(value) => setUniversityId(value)}
                required
                className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
              >
                <option value="">
                  {role === "student" ? "Select university" : "Select university"}
                </option>
                {universities.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Dropdown>
            </label>
          )}
          {role === "student" && (
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-2">
              Student record
              <Dropdown chevron
                value={studentId}
                onChange={(value) => setStudentId(value)}
                required
                className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
              >
                <option value="">Select student</option>
                {students.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name ?? "Unnamed student"}
                    {item.email ? ` · ${item.email}` : ""}
                  </option>
                ))}
              </Dropdown>
            </label>
          )}
          {role === "mentor" && universityId ? (
            <fieldset data-tour="users-squads" className="flex flex-col gap-1.5 text-xs font-semibold text-ink-2 sm:col-span-2">
              <legend className="mb-1.5">Squads this mentor looks after</legend>
              {squadOptions.length === 0 ? (
                <p className="text-[12.5px] font-normal text-muted">This university has no squads yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {squadOptions.map((squad) => {
                    const on = squadIds.includes(squad.id);
                    return (
                      <button
                        key={squad.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setSquadIds((current) =>
                            on ? current.filter((id) => id !== squad.id) : [...current, squad.id],
                          )
                        }
                        className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${
                          on ? "border-ink bg-ink text-page" : "border-line-strong text-ink-2 hover:border-ink/40"
                        }`}
                      >
                        Squad {squad.squad_number}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-[11.5px] font-normal text-muted">
                Mentors only see these squads{squadIds.length === 0 ? " — with none picked they see nothing yet" : ""}.
              </p>
            </fieldset>
          ) : null}
          <div className="flex items-center justify-end gap-2 self-end">
            {editingEmail && (
              <button
                type="button"
                onClick={() => {
                  setEditingEmail(null);
                  setName("");
                  setEmail("");
                  setStudentId("");
                }}
                className="rounded-lg border border-line-strong px-3 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
            )}
            <button
              disabled={saving}
              aria-busy={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-action-hover px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-wait disabled:opacity-70"
            >
              {saving ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <UserPlus size={16} />
              )}
              {saving ? "Saving…" : editingEmail ? "Update assignment" : "Save assignment"}
            </button>
          </div>
        </form>
        {message && (
          <p className="bg-surface-2 px-4 py-2.5 text-sm text-ink-2 sm:px-5" role="status">
            {message}
          </p>
        )}
        <UserFilters
          value={filters}
          onChange={setFilters}
          universities={universities}
          roles={Object.entries(labels)}
          shown={visibleUsers.length}
          total={users.length}
        />
        {loading ? (
          <PanelSkeleton rows={6} label="Loading users" flat />
        ) : (
          <MemberList
            data-tour="users-table"
            rows={visibleUsers}
            rowKey={(user) => `${user.status}:${user.email}`}
            leadHeader="User"
            empty="No matching users."
            lead={(user) => ({
              title: user.full_name ?? user.email,
              subtitle: user.email,
              avatar: { name: user.full_name ?? user.email, seed: user.email },
              presence: presenceOf(user, now),
              presenceLabel: lastActiveLabel(user, now),
            })}
            columns={[
              {
                key: "role",
                header: "Role",
                width: "w-36",
                render: (user) => (
                  <Pill tone={user.role === "super_admin" || user.role === "developer" ? "brand" : "neutral"}>
                    {labels[user.role]}
                  </Pill>
                ),
              },
              {
                key: "scope",
                header: "Campus · squads",
                width: "w-52",
                hideBelow: "md",
                render: (user) => (
                  <span className="min-w-0 truncate">
                    {user.university_name ?? user.student_name ?? "All campuses"}
                    {user.role === "mentor" ? (
                      user.squads?.length ? (
                        <span className="text-muted"> · {user.squads.map((squad) => squad.squad_number).join(", ")}</span>
                      ) : (
                        <span className="text-brand-text"> · no squads</span>
                      )
                    ) : null}
                  </span>
                ),
              },
              {
                key: "status",
                header: "Last active",
                width: "w-32",
                hideBelow: "lg",
                render: (user) => {
                  const presence = presenceOf(user, now);
                  return (
                    <span
                      className={
                        presence === "online" ? "text-success-text" : presence === "never" ? "text-brand-text" : "text-muted"
                      }
                    >
                      {lastActiveLabel(user, now)}
                    </span>
                  );
                },
              },
              {
                key: "actions",
                header: <span className="sr-only">Actions</span>,
                width: "w-44",
                align: "right",
                render: (user) => (
                  <div className="flex items-center justify-end gap-2">
                    {user.status === "active" && (
                      <button
                        type="button"
                        data-tour="users-edit"
                        onClick={() => editUser(user)}
                        className="h-7 rounded-md border border-line-strong px-2.5 text-[12px] font-medium text-ink-2 transition hover:text-ink"
                      >
                        Edit
                      </button>
                    )}
                    {user.email.toLowerCase() === myEmail ? (
                      <span className="px-2 text-[11.5px] text-faint">You</span>
                    ) : (
                      <span data-tour="users-delete" className="inline-flex">
                        <HoldButton
                          size="sm"
                          radius={6}
                          holdTime={1200}
                          resetAfter={900}
                          backgroundColor="color-mix(in srgb, var(--action) 10%, var(--surface))"
                          textColor="var(--brand-text)"
                          fillColor="#dc2626"
                          fillTextColor="#ffffff"
                          waveAmplitude={5}
                          icon={<Trash2 size={13} />}
                          doneLabel="Confirm…"
                          aria-label={`Hold to delete ${user.full_name ?? user.email}`}
                          onHold={() => setDeleting(user)}
                        >
                          Delete
                        </HoldButton>
                      </span>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Frame>

      <DeleteUserDialog
        user={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(user) => {
          setDeleting(null);
          setUsers((current) =>
            current.filter((item) => item.email !== user.email),
          );
          setToast({
            id: Date.now(),
            message: `${user.full_name ?? user.email} deleted`,
          });
          void load();
        }}
      />
      <Toast toast={toast} onDone={() => setToast(null)} />
    </Page>
  );
}
