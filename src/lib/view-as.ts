import type { UserProfile } from "@/lib/auth/profile";

/**
 * "View as": a developer can see the app exactly as a campus manager, mentor
 * or student would. The choice lives in a cookie; the server applies it only
 * when the real signed-in user is a developer, so forging the cookie gives
 * nobody else anything. While it is set, the proxy refuses every change.
 */
export const VIEW_AS_COOKIE = "dojo_view_as";
export const VIEW_AS_ROLES = ["campus_manager", "mentor", "student"] as const;
export type ViewAsRole = (typeof VIEW_AS_ROLES)[number];

export type ViewAs = {
  role: ViewAsRole;
  university_id: string | null;
  student_id: string | null;
  /** Mentor views are limited to these squads. */
  squad_ids?: string[];
  /** Human label for the banner, e.g. "Campus manager · St Joseph University". */
  label: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseViewAs(raw: string | null | undefined): ViewAs | null {
  if (!raw) return null;
  try {
    // Cookie values may arrive URL-encoded once or twice depending on who
    // wrote and read them; unwrap until it is the JSON object.
    let text = raw;
    for (let pass = 0; pass < 3 && !text.trim().startsWith("{"); pass += 1) text = decodeURIComponent(text);
    const value = JSON.parse(text) as Partial<ViewAs>;
    if (!VIEW_AS_ROLES.includes(value.role as ViewAsRole)) return null;
    const university = typeof value.university_id === "string" && UUID.test(value.university_id)
      ? value.university_id
      : null;
    const student = typeof value.student_id === "string" && UUID.test(value.student_id)
      ? value.student_id
      : null;
    // Each role needs what its real accounts always have.
    if (value.role === "student" && !student) return null;
    if (value.role !== "student" && !university) return null;
    return {
      role: value.role as ViewAsRole,
      university_id: university,
      student_id: value.role === "student" ? student : null,
      squad_ids: Array.isArray(value.squad_ids)
        ? value.squad_ids.filter((id): id is string => typeof id === "string" && UUID.test(id))
        : [],
      label: typeof value.label === "string" ? value.label.slice(0, 120) : "Another role",
    };
  } catch {
    return null;
  }
}

/** Plain JSON; the cookie layer URL-encodes it on the way out. */
export function serializeViewAs(viewAs: ViewAs) {
  return JSON.stringify(viewAs);
}

/** The profile the app should act on: the viewed role for developers, else unchanged. */
export function applyViewAs(profile: UserProfile, raw: string | null | undefined): UserProfile {
  if (!profile.is_developer) return profile;
  const viewAs = parseViewAs(raw);
  if (!viewAs) return profile;
  return {
    ...profile,
    role: viewAs.role,
    university_id: viewAs.university_id,
    student_id: viewAs.student_id,
    squad_ids: viewAs.role === "mentor" ? (viewAs.squad_ids ?? []) : null,
    viewing_as: viewAs,
  };
}

/** Reads the View as cookie in the browser (it is not HttpOnly on purpose). */
export function readViewAsCookie() {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${VIEW_AS_COOKIE}=`));
  return match ? match.slice(VIEW_AS_COOKIE.length + 1) : null;
}
