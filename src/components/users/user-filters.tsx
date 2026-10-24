"use client";

import { useEffect, useRef, useState } from "react";
import { Ban, Check, ChevronDown, Search, X } from "lucide-react";
import { Dropdown } from "@/components/ui/dropdown";
import {
  EMPTY_FILTERS,
  activeFilterCount,
  type Presence,
  type UserFilterState,
  type UserSort,
} from "@/lib/user-filters";

const PRESENCE: Array<{ id: Presence; label: string; color: string }> = [
  { id: "online", label: "Active now", color: "#22c55e" },
  { id: "offline", label: "Not active", color: "#a1a1aa" },
  { id: "never", label: "Never signed in", color: "#ef3837" },
];

const SORTS: Array<[UserSort, string]> = [
  ["name", "Name A–Z"],
  ["role", "Role"],
  ["university", "University"],
  ["last_active", "Last active"],
];

/** Search, multi-university, include/exclude roles, activity and sort. */
export function UserFilters({
  value,
  onChange,
  universities,
  roles,
  shown,
  total,
}: {
  value: UserFilterState;
  onChange: (next: UserFilterState) => void;
  universities: Array<{ id: string; name: string | null }>;
  roles: Array<[string, string]>;
  shown: number;
  total: number;
}) {
  const count = activeFilterCount(value);
  const set = (patch: Partial<UserFilterState>) => onChange({ ...value, ...patch });

  function cycleRole(role: string) {
    const next = { ...value.roles };
    // Off → only these → hide these → off.
    if (!next[role]) next[role] = "include";
    else if (next[role] === "include") next[role] = "exclude";
    else delete next[role];
    set({ roles: next });
  }

  return (
    <div data-tour="users-search" className="space-y-2.5 bg-surface-2 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3">
          <Search size={15} className="text-muted" />
          <span className="sr-only">Search users</span>
          <input
            value={value.search}
            onChange={(event) => set({ search: event.target.value })}
            placeholder="Search name, email, campus or squad"
            className="w-full bg-transparent text-[13.5px] outline-none placeholder:text-faint"
          />
          {value.search ? (
            <button type="button" aria-label="Clear search" onClick={() => set({ search: "" })} className="text-muted hover:text-ink">
              <X size={14} />
            </button>
          ) : null}
        </label>
        <UniversityPicker
          universities={universities}
          selected={value.universities}
          onChange={(next) => set({ universities: next })}
        />
        <Dropdown
          chevron
          aria-label="Sort by"
          value={value.sort}
          onChange={(next) => set({ sort: next as UserSort })}
          className="h-9 rounded-lg border border-line-strong bg-surface px-3 text-[13px]"
        >
          {SORTS.map(([id, label]) => (
            <option key={id} value={id}>
              Sort: {label}
            </option>
          ))}
        </Dropdown>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Roles">
          <span className="mr-0.5 text-[11.5px] font-medium text-muted">Roles</span>
          {roles.map(([role, label]) => {
            const rule = value.roles[role];
            return (
              <button
                key={role}
                type="button"
                onClick={() => cycleRole(role)}
                aria-label={`${label}: ${rule === "include" ? "only these" : rule === "exclude" ? "hidden" : "any"}`}
                title="Click: only this role · again: hide this role · again: off"
                className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[12px] font-medium transition ${
                  rule === "include"
                    ? "border-ink bg-ink text-page"
                    : rule === "exclude"
                      ? "border-brand-line bg-brand-soft text-brand-text line-through decoration-1"
                      : "border-line-strong text-ink-2 hover:border-ink/40 hover:text-ink"
                }`}
              >
                {rule === "include" ? <Check size={12} /> : rule === "exclude" ? <Ban size={12} /> : null}
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Activity">
          <span className="mr-0.5 text-[11.5px] font-medium text-muted">Activity</span>
          {PRESENCE.map((item) => {
            const on = value.presence.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  set({ presence: on ? value.presence.filter((id) => id !== item.id) : [...value.presence, item.id] })
                }
                className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[12px] font-medium transition ${
                  on ? "border-ink bg-ink text-page" : "border-line-strong text-ink-2 hover:border-ink/40 hover:text-ink"
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-3 text-[12px] text-muted">
          <span>
            {shown === total ? `${total} users` : `${shown} of ${total} users`}
          </span>
          {count ? (
            <button
              type="button"
              onClick={() => onChange({ ...EMPTY_FILTERS, sort: value.sort })}
              className="font-medium text-ink-2 hover:text-ink"
            >
              Clear filters ({count})
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function UniversityPicker({
  universities,
  selected,
  onChange,
}: {
  universities: Array<{ id: string; name: string | null }>;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const options = [{ id: "none", name: "No university (admins)" }, ...universities];
  const visible = options.filter((item) => (item.name ?? "").toLowerCase().includes(query.trim().toLowerCase()));
  const names = options.filter((item) => selected.includes(item.id)).map((item) => item.name ?? "");
  const label = !selected.length
    ? "All universities"
    : selected.length <= 2
      ? names.join(", ")
      : `${names.slice(0, 2).join(", ")} +${selected.length - 2}`;

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex h-9 max-w-[260px] items-center gap-2 rounded-lg border bg-surface px-3 text-[13px] ${
          selected.length ? "border-ink text-ink" : "border-line-strong text-ink-2"
        }`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={14} className="shrink-0 text-muted" />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-72 rounded-xl border border-line bg-surface p-1.5 shadow-[var(--pop-shadow)]">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a university"
            className="mb-1 h-8 w-full rounded-md border border-line-strong bg-surface px-2.5 text-[13px] outline-none placeholder:text-faint focus:border-ink"
          />
          <ul role="listbox" aria-multiselectable="true" className="max-h-64 overflow-y-auto">
            {visible.map((item) => {
              const on = selected.includes(item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => onChange(on ? selected.filter((id) => id !== item.id) : [...selected, item.id])}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-sunken"
                  >
                    <span
                      className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                        on ? "border-ink bg-ink text-page" : "border-line-strong"
                      }`}
                    >
                      {on ? <Check size={11} strokeWidth={3} /> : null}
                    </span>
                    <span className="truncate">{item.name}</span>
                  </button>
                </li>
              );
            })}
            {!visible.length ? <li className="px-2 py-2 text-[12.5px] text-muted">No match</li> : null}
          </ul>
          {selected.length ? (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-[12.5px] font-medium text-muted hover:bg-sunken hover:text-ink"
            >
              Clear selection
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
