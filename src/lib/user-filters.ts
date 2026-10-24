// Filtering and sorting for the Users list. Kept free of imports for tests.

export type Presence = "online" | "offline" | "never";
export type RoleRule = "include" | "exclude";
export type UserSort = "name" | "role" | "university" | "last_active";

export type FilterableUser = {
  email: string;
  full_name: string | null;
  role: string;
  university_id: string | null;
  university_name: string | null;
  student_name: string | null;
  squads?: Array<{ squad_number: string }>;
  status: "active" | "pending";
  last_seen_at: string | null;
  last_sign_in_at: string | null;
};

export type UserFilterState = {
  search: string;
  /** University ids to keep; "none" keeps people with no university. Empty = all. */
  universities: string[];
  /** Per-role rules. Includes keep only those roles; excludes drop them. */
  roles: Record<string, RoleRule>;
  presence: Presence[];
  sort: UserSort;
};

export const EMPTY_FILTERS: UserFilterState = {
  search: "",
  universities: [],
  roles: {},
  presence: [],
  sort: "name",
};

/** Online if seen in the last 5 minutes; never if they haven't signed in. */
export const ONLINE_WINDOW_MS = 5 * 60_000;

export function presenceOf(user: FilterableUser, now = Date.now()): Presence {
  if (user.status === "pending" || (!user.last_sign_in_at && !user.last_seen_at)) return "never";
  if (user.last_seen_at && now - Date.parse(user.last_seen_at) < ONLINE_WINDOW_MS) return "online";
  return "offline";
}

const ROLE_ORDER = ["developer", "super_admin", "campus_manager", "mentor", "student"];

export function activeFilterCount(filters: UserFilterState) {
  return (
    (filters.search.trim() ? 1 : 0) +
    (filters.universities.length ? 1 : 0) +
    Object.keys(filters.roles).length +
    (filters.presence.length ? 1 : 0)
  );
}

export function applyUserFilters<T extends FilterableUser>(users: T[], filters: UserFilterState, now = Date.now()): T[] {
  const query = filters.search.trim().toLowerCase();
  const includes = Object.entries(filters.roles)
    .filter(([, rule]) => rule === "include")
    .map(([role]) => role);
  const excludes = new Set(
    Object.entries(filters.roles)
      .filter(([, rule]) => rule === "exclude")
      .map(([role]) => role),
  );
  const universities = new Set(filters.universities);
  const presence = new Set(filters.presence);

  const kept = users.filter((user) => {
    if (query) {
      const haystack = [
        user.full_name,
        user.email,
        user.university_name,
        user.student_name,
        ...(user.squads ?? []).map((squad) => squad.squad_number),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (universities.size && !universities.has(user.university_id ?? "none")) return false;
    if (includes.length && !includes.includes(user.role)) return false;
    if (excludes.has(user.role)) return false;
    if (presence.size && !presence.has(presenceOf(user, now))) return false;
    return true;
  });

  const name = (user: T) => (user.full_name ?? user.email).toLowerCase();
  const seen = (user: T) => Date.parse(user.last_seen_at ?? user.last_sign_in_at ?? "") || 0;
  const compare: Record<UserSort, (a: T, b: T) => number> = {
    name: (a, b) => name(a).localeCompare(name(b)),
    role: (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || name(a).localeCompare(name(b)),
    university: (a, b) =>
      (a.university_name ?? "￿").localeCompare(b.university_name ?? "￿") || name(a).localeCompare(name(b)),
    last_active: (a, b) => seen(b) - seen(a) || name(a).localeCompare(name(b)),
  };
  return [...kept].sort(compare[filters.sort]);
}

/** "Active now", "5m ago", "3d ago", "Never signed in". */
export function lastActiveLabel(user: FilterableUser, now = Date.now()) {
  const presence = presenceOf(user, now);
  if (presence === "never") return "Never signed in";
  if (presence === "online") return "Active now";
  const at = Date.parse(user.last_seen_at ?? user.last_sign_in_at ?? "");
  if (!at) return "Signed in before";
  const minutes = Math.max(1, Math.round((now - at) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 60 ? `${days}d ago` : `${Math.round(days / 30)}mo ago`;
}
