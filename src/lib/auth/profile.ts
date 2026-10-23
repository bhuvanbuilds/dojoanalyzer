import type { SupabaseClient, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { applyViewAs, readViewAsCookie, type ViewAs } from "@/lib/view-as";

export const USER_ROLES = [
  "super_admin",
  "campus_manager",
  "mentor",
  "student",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

/**
 * Roles that can be stored and assigned. A developer has every super admin
 * power (the app treats them as `super_admin` with `is_developer` set) and
 * is the only role that stays in the app while maintenance mode is on.
 */
export const ASSIGNABLE_ROLES = [...USER_ROLES, "developer"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export type UserProfile = {
  id: string;
  full_name: string | null;
  role: UserRole;
  university_id: string | null;
  student_id: string | null;
  is_developer: boolean;
  /**
   * Squads this person is limited to: a mentor's assigned squads (possibly
   * none). null means no squad limit (everyone except mentors).
   */
  squad_ids: string[] | null;
  /** Set while a developer is using "View as"; role and scope are the viewed ones. */
  viewing_as?: ViewAs | null;
};

type ProfileRow = Omit<UserProfile, "role" | "is_developer" | "squad_ids"> & {
  role: string;
};

export type CurrentUserProfile =
  | {
      status: "authenticated";
      user: User;
      profile: UserProfile;
    }
  | {
      status: "unauthenticated";
      user: null;
      profile: null;
    }
  | {
      status: "unassigned" | "invalid_role";
      user: User;
      profile: null;
    }
  | {
      status: "error";
      user: User | null;
      profile: null;
      message: string;
    };

/** Google profile photo from the OAuth identity, when there is one. */
export function avatarUrlOf(user: User | null | undefined): string | null {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const url = meta.avatar_url ?? meta.picture;
  return typeof url === "string" && url.startsWith("https://") ? url : null;
}

function isUserRole(role: string): role is UserRole {
  return USER_ROLES.includes(role as UserRole);
}

// ─── Browser cache ────────────────────────────────────────────────────────────
// Every page asks for the profile on mount. In the browser we share one
// lookup (for 5 minutes) so moving between pages doesn't flash a loading
// state; signing in or out clears it.
const CACHE_MS = 5 * 60 * 1000;
let cached: { at: number; promise: Promise<CurrentUserProfile> } | null = null;
let settled: CurrentUserProfile | null = null;
let listening = false;

export function clearProfileCache() {
  cached = null;
  settled = null;
}

/** The last resolved profile, if one is cached; lets pages skip a loading frame. */
export function peekCurrentUserProfile(): CurrentUserProfile | null {
  if (typeof window === "undefined" || !cached) return null;
  return Date.now() - cached.at < CACHE_MS ? settled : null;
}

export async function getCurrentUserProfile(
  client: SupabaseClient = supabase,
): Promise<CurrentUserProfile> {
  if (typeof window === "undefined" || client !== supabase)
    return loadCurrentUserProfile(client).then((result) =>
      withViewAs(result, (client as { viewAsCookie?: string | null }).viewAsCookie),
    );

  if (!listening) {
    listening = true;
    supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN" || event === "USER_UPDATED")
        clearProfileCache();
    });
  }
  if (!cached || Date.now() - cached.at > CACHE_MS) {
    const entry = {
      at: Date.now(),
      promise: loadCurrentUserProfile(client).then((loaded) => {
        const result = withViewAs(loaded, readViewAsCookie());
        // Only keep answers worth reusing.
        if (result.status === "error") {
          if (cached === entry) cached = null;
        } else if (cached === entry) settled = result;
        return result;
      }),
    };
    cached = entry;
    settled = null;
  }
  return cached.promise;
}

/** A mentor's assigned squads; an error counts as none, so nothing leaks. */
async function loadMentorSquads(client: SupabaseClient, profileId: string) {
  const { data, error } = await client
    .from("mentor_squads")
    .select("squad_id")
    .eq("profile_id", profileId);
  if (error) return [];
  return (data ?? []).map((row) => row.squad_id as string);
}

/** Applies a developer's "View as" choice; everyone else is untouched. */
function withViewAs(result: CurrentUserProfile, raw: string | null | undefined): CurrentUserProfile {
  if (result.status !== "authenticated") return result;
  return { ...result, profile: applyViewAs(result.profile, raw) };
}

async function loadCurrentUserProfile(
  client: SupabaseClient,
): Promise<CurrentUserProfile> {
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return {
      status: "unauthenticated",
      user: null,
      profile: null,
    };
  }

  const { data: profileData, error } = await client
    .from("profiles")
    .select("id, full_name, role, university_id, student_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return {
      status: "error",
      user,
      profile: null,
      message: "Unable to load your account profile.",
    };
  }

  if (!profileData) {
    return {
      status: "unassigned",
      user,
      profile: null,
    };
  }

  const profile = profileData as ProfileRow;

  if (profile.role === "developer") {
    if (profile.university_id !== null || profile.student_id !== null)
      return { status: "invalid_role", user, profile: null };
    return {
      status: "authenticated",
      user,
      profile: { ...profile, role: "super_admin", is_developer: true, squad_ids: null },
    };
  }

  if (
    !isUserRole(profile.role) ||
    (profile.role === "super_admin" &&
      (profile.university_id !== null || profile.student_id !== null)) ||
    ((profile.role === "campus_manager" || profile.role === "mentor") &&
      (!profile.university_id || profile.student_id !== null)) ||
    (profile.role === "student" && !profile.student_id)
  ) {
    return {
      status: "invalid_role",
      user,
      profile: null,
    };
  }

  return {
    status: "authenticated",
    user,
    profile: {
      ...profile,
      role: profile.role,
      is_developer: false,
      squad_ids: profile.role === "mentor" ? await loadMentorSquads(client, profile.id) : null,
    },
  };
}
