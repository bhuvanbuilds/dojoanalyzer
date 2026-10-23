import type { UserProfile } from "@/lib/auth/profile";

/**
 * The squads a person may see, or null for no squad limit. Mentors only see
 * the squads assigned to them (an empty list means none yet).
 */
export function squadLimit(profile: UserProfile): string[] | null {
  return profile.role === "mentor" ? (profile.squad_ids ?? []) : null;
}

/** True when the squad is visible under that limit. */
export function inSquadLimit(limit: string[] | null, squadId: string | null | undefined) {
  return limit === null || (Boolean(squadId) && limit.includes(squadId!));
}
