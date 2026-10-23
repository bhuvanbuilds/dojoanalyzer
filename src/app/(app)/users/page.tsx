"use client";

import { useEffect, useState } from "react";
import { Search, Trash2, UserPlus } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { PanelSkeleton } from "@/components/ui/skeleton";
import { Frame, FrameTitle, Page } from "@/components/ui/frame";
import { HoldButton } from "@/components/reactbits/hold-button";
import { DeleteUserDialog } from "@/components/users/delete-user-dialog";
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
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
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

  async function load(filters: { search?: string; roleFilter?: string } = {}) {
    const query = new URLSearchParams();
    const activeSearch = filters.search ?? search;
    const activeRole = filters.roleFilter ?? roleFilter;
    if (activeSearch.trim()) query.set("search", activeSearch.trim());
    if (activeRole !== "all") query.set("role", activeRole);
    const response = await fetch(`/api/super-admin/users?${query}`);
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
          description="Assign Google accounts to a role, university or student record."
        />
        <form
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
            <fieldset className="flex flex-col gap-1.5 text-xs font-semibold text-ink-2 sm:col-span-2">
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
        <div className="flex flex-wrap gap-2 bg-surface-2 px-4 py-2.5 sm:px-5">
          <label className="flex min-w-60 flex-1 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3">
            <Search size={16} className="text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void load();
                }
              }}
              placeholder="Search name or email"
              className="w-full bg-transparent py-2 text-sm outline-none"
            />
          </label>
          <Dropdown chevron
            aria-label="Filter by role"
            value={roleFilter}
            onChange={(value) => {
              setRoleFilter(value);
              void load({ roleFilter: value });
            }}
            className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
          >
            <option value="all">All roles</option>
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Dropdown>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-semibold"
          >
            Search
          </button>
        </div>
        {loading ? (
          <PanelSkeleton rows={6} label="Loading users" flat />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-[11px] uppercase tracking-[0.06em] text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-semibold sm:px-5">User</th>
                  <th className="px-4 py-2.5 font-semibold sm:px-5">Role</th>
                  <th className="px-4 py-2.5 font-semibold sm:px-5">University / student</th>
                  <th className="px-4 py-2.5 font-semibold sm:px-5">Status</th>
                  <th className="px-4 py-2.5 text-right font-semibold sm:px-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-surface">
                {users.map((user) => (
                  <tr key={`${user.status}:${user.email}`}>
                    <td className="px-4 py-3 sm:px-5">
                      <p className="font-semibold text-ink">
                        {user.full_name ?? "—"}
                      </p>
                      <p className="text-xs text-muted">{user.email}</p>
                    </td>
                    <td className="px-4 py-3 sm:px-5">{labels[user.role]}</td>
                    <td className="px-4 py-3 sm:px-5">
                      {user.university_name ?? user.student_name ?? "Global"}
                      {user.role === "mentor" && user.squads?.length ? (
                        <span className="block text-[12px] text-muted">
                          Squads {user.squads.map((squad) => squad.squad_number).join(", ")}
                        </span>
                      ) : user.role === "mentor" ? (
                        <span className="block text-[12px] text-brand-text">No squads assigned</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 sm:px-5">
                      <span
                        className={
                          user.status === "active"
                            ? "text-success-text"
                            : "text-warning-text"
                        }
                      >
                        {user.status === "active"
                          ? "Active"
                          : "Pending Google sign-in"}
                      </span>
                    </td>
                    <td className="px-4 py-3 sm:px-5">
                      <div className="flex items-center justify-end gap-2">
                        {user.status === "active" && (
                          <button
                            type="button"
                            onClick={() => editUser(user)}
                            className="h-8 rounded-lg border border-line-strong px-3 text-xs font-semibold text-ink-2 transition hover:text-ink"
                          >
                            Edit
                          </button>
                        )}
                        {user.email.toLowerCase() === myEmail ? (
                          <span className="px-2 text-[11.5px] text-faint">
                            You
                          </span>
                        ) : (
                          <HoldButton
                            size="sm"
                            radius={8}
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
                            Hold to delete
                          </HoldButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!users.length && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-muted"
                    >
                      No matching users.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
