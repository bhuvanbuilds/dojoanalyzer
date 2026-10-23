import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { requireRoles, writeAuditLog } from "@/lib/auth/authorization";
import { isUuid } from "@/lib/is-uuid";
import { supabaseAdmin } from "@/lib/supabase/server";

// Campus managers add mentors to their own campus and choose their squads.
// Super admins can do the same for any campus by passing a university id.

const FAILED = () =>
  NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });

const normalizeEmail = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");

async function findAuthUser(email: string): Promise<User | null> {
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
}

/** The campus this request may manage, or an error response. */
async function campusFor(request: Request, bodyUniversityId?: unknown) {
  const authorization = await requireRoles(["campus_manager", "super_admin"]);
  if (authorization.response) return { response: authorization.response } as const;
  const { profile, user } = authorization;
  if (profile.role === "campus_manager") {
    if (!profile.university_id)
      return { response: NextResponse.json({ error: "Your account has no campus" }, { status: 403 }) } as const;
    return { universityId: profile.university_id, actorId: user.id } as const;
  }
  const requested = bodyUniversityId ?? new URL(request.url).searchParams.get("university_id");
  if (!isUuid(requested))
    return { response: NextResponse.json({ error: "Choose a university" }, { status: 400 }) } as const;
  return { universityId: requested, actorId: user.id } as const;
}

/** Squad ids that really belong to this campus, or null if any don't. */
async function campusSquads(universityId: string, value: unknown) {
  const requested = Array.isArray(value) ? [...new Set(value.filter(isUuid))] : [];
  if (Array.isArray(value) && requested.length !== value.length) return null;
  if (!requested.length) return [];
  const { data, error } = await supabaseAdmin
    .from("squads")
    .select("id")
    .in("id", requested)
    .eq("university_id", universityId);
  if (error) throw error;
  return (data ?? []).length === requested.length ? requested : null;
}

/** GET: the campus's mentors (active and invited) and its squads. */
export async function GET(request: Request) {
  const campus = await campusFor(request);
  if (campus.response) return campus.response;
  try {
    const [profiles, invitations, squads] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name").eq("role", "mentor").eq("university_id", campus.universityId),
      supabaseAdmin
        .from("user_invitations")
        .select("email, full_name, squad_ids")
        .eq("role", "mentor")
        .eq("university_id", campus.universityId),
      supabaseAdmin.from("squads").select("id, squad_number").eq("university_id", campus.universityId).order("squad_number"),
    ]);
    for (const result of [profiles, invitations, squads]) if (result.error) throw result.error;
    const ids = (profiles.data ?? []).map((row) => row.id);
    const links = ids.length
      ? await supabaseAdmin.from("mentor_squads").select("profile_id, squad_id").in("profile_id", ids)
      : { data: [], error: null };
    if (links.error) throw links.error;
    const emails = new Map<string, string>();
    await Promise.all(
      ids.map(async (id) => {
        const { data } = await supabaseAdmin.auth.admin.getUserById(id);
        if (data.user?.email) emails.set(id, data.user.email);
      }),
    );
    const mentors = [
      ...(profiles.data ?? []).map((row) => ({
        email: emails.get(row.id) ?? "",
        full_name: row.full_name,
        squad_ids: (links.data ?? []).filter((link) => link.profile_id === row.id).map((link) => link.squad_id as string),
        status: "active" as const,
      })),
      ...(invitations.data ?? []).map((row) => ({
        email: row.email,
        full_name: row.full_name,
        squad_ids: (row.squad_ids as string[] | null) ?? [],
        status: "pending" as const,
      })),
    ].sort((a, b) => (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email));
    return NextResponse.json({ mentors, squads: squads.data ?? [] });
  } catch (error) {
    console.error("Campus mentors GET error:", error);
    return FAILED();
  }
}

/**
 * POST { email, fullName, squadIds, universityId? }: adds a mentor to the
 * campus, or updates an existing mentor's squads. Someone who already holds
 * another role, or belongs to another campus, is left for a super admin.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: unknown;
    fullName?: unknown;
    squadIds?: unknown;
    universityId?: unknown;
  };
  const campus = await campusFor(request, body.universityId);
  if (campus.response) return campus.response;
  try {
    const email = normalizeEmail(body.email);
    const fullName = typeof body.fullName === "string" ? body.fullName.trim().slice(0, 120) : "";
    if (!/^\S+@\S+\.\S+$/.test(email) || !fullName)
      return NextResponse.json({ error: "Enter the mentor’s name and Google account email" }, { status: 400 });
    const squadIds = await campusSquads(campus.universityId, body.squadIds);
    if (squadIds === null)
      return NextResponse.json({ error: "Pick squads from this campus only" }, { status: 400 });

    const authUser = await findAuthUser(email);
    if (authUser) {
      const { data: existing, error } = await supabaseAdmin
        .from("profiles")
        .select("role, university_id")
        .eq("id", authUser.id)
        .maybeSingle();
      if (error) throw error;
      if (existing && (existing.role !== "mentor" || existing.university_id !== campus.universityId))
        return NextResponse.json(
          { error: "This person already has another role or campus. Ask a super admin to change it." },
          { status: 409 },
        );
      const { error: upsertError } = await supabaseAdmin
        .from("profiles")
        .upsert(
          { id: authUser.id, full_name: fullName, role: "mentor", university_id: campus.universityId, student_id: null },
          { onConflict: "id" },
        );
      if (upsertError) throw upsertError;
      const { error: clearError } = await supabaseAdmin.from("mentor_squads").delete().eq("profile_id", authUser.id);
      if (clearError) throw clearError;
      if (squadIds.length) {
        const { error: insertError } = await supabaseAdmin
          .from("mentor_squads")
          .insert(squadIds.map((squadId) => ({ profile_id: authUser.id, squad_id: squadId })));
        if (insertError) throw insertError;
      }
      await writeAuditLog(campus.actorId, existing ? "mentor_squads_updated" : "mentor_added", "profile", authUser.id, {
        email,
        university_id: campus.universityId,
        squad_ids: squadIds,
      });
      return NextResponse.json({ status: "active" });
    }

    // Not signed in yet: invite them; access applies on first Google sign-in.
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("user_invitations")
      .select("role, university_id")
      .eq("email", email)
      .maybeSingle();
    if (inviteError) throw inviteError;
    if (invite && (invite.role !== "mentor" || invite.university_id !== campus.universityId))
      return NextResponse.json(
        { error: "This email is already invited with another role or campus. Ask a super admin." },
        { status: 409 },
      );
    const { error } = await supabaseAdmin.from("user_invitations").upsert(
      {
        email,
        full_name: fullName,
        role: "mentor",
        university_id: campus.universityId,
        student_id: null,
        squad_ids: squadIds,
        created_by: campus.actorId,
      },
      { onConflict: "email" },
    );
    if (error) throw error;
    await writeAuditLog(campus.actorId, invite ? "mentor_squads_updated" : "mentor_invited", "invitation", email, {
      email,
      university_id: campus.universityId,
      squad_ids: squadIds,
    });
    return NextResponse.json({ status: "pending" }, { status: 202 });
  } catch (error) {
    console.error("Campus mentors POST error:", error);
    return FAILED();
  }
}

/** DELETE { email, universityId? }: removes a mentor's access to this campus. */
export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; universityId?: unknown };
  const campus = await campusFor(request, body.universityId);
  if (campus.response) return campus.response;
  try {
    const email = normalizeEmail(body.email);
    if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });
    const authUser = await findAuthUser(email);
    let removed = false;
    if (authUser) {
      const { data: existing, error } = await supabaseAdmin
        .from("profiles")
        .select("role, university_id")
        .eq("id", authUser.id)
        .maybeSingle();
      if (error) throw error;
      if (existing?.role === "mentor" && existing.university_id === campus.universityId) {
        const { error: squadError } = await supabaseAdmin.from("mentor_squads").delete().eq("profile_id", authUser.id);
        if (squadError) throw squadError;
        const { error: profileError } = await supabaseAdmin.from("profiles").delete().eq("id", authUser.id);
        if (profileError) throw profileError;
        removed = true;
      }
    }
    const { data: invites, error: inviteError } = await supabaseAdmin
      .from("user_invitations")
      .delete()
      .eq("email", email)
      .eq("role", "mentor")
      .eq("university_id", campus.universityId)
      .select("email");
    if (inviteError) throw inviteError;
    removed ||= (invites ?? []).length > 0;
    if (!removed) return NextResponse.json({ error: "Not a mentor on this campus" }, { status: 404 });
    await writeAuditLog(campus.actorId, "mentor_removed", "user", authUser?.id ?? email, {
      email,
      university_id: campus.universityId,
    });
    return NextResponse.json({ removed: true });
  } catch (error) {
    console.error("Campus mentors DELETE error:", error);
    return FAILED();
  }
}
