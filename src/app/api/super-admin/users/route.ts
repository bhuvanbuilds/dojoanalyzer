import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { requireSuperAdmin, writeAuditLog } from "@/lib/auth/authorization";
import { ASSIGNABLE_ROLES, type AssignableRole } from "@/lib/auth/profile";

// Super admins and developers are global: no university, no student record.
const isGlobalRole = (role: string | null | undefined) =>
  role === "super_admin" || role === "developer";
import { supabaseAdmin } from "@/lib/supabase/server";

async function listAuthUsers() {
  const users: User[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function GET(request: Request) {
  const authorization = await requireSuperAdmin();
  if (authorization.response) return authorization.response;
  try {
    const searchParams = new URL(request.url).searchParams;
    const search = searchParams.get("search")?.trim().toLowerCase() ?? "";
    const roleFilter = searchParams.get("role") ?? "all";
    const [
      authUsers,
      profilesResult,
      invitationsResult,
      universitiesResult,
      studentsResult,
      mentorSquadsResult,
      squadsResult,
    ] = await Promise.all([
      listAuthUsers(),
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, role, university_id, student_id, last_seen_at"),
      supabaseAdmin
        .from("user_invitations")
        .select(
          "email, full_name, role, university_id, student_id, squad_ids, updated_at",
        ),
      supabaseAdmin.from("universities").select("id, name:display_name").order("name"),
      supabaseAdmin.from("students").select("id, name, email").order("name"),
      supabaseAdmin.from("mentor_squads").select("profile_id, squad_id"),
      supabaseAdmin.from("squads").select("id, squad_number"),
    ]);
    for (const result of [
      profilesResult,
      invitationsResult,
      universitiesResult,
      studentsResult,
      mentorSquadsResult,
      squadsResult,
    ])
      if (result.error) throw result.error;
    const authById = new Map(authUsers.map((user) => [user.id, user]));
    const universityNames = new Map(
      (universitiesResult.data ?? []).map((row) => [row.id, row.name]),
    );
    const studentNames = new Map(
      (studentsResult.data ?? []).map((row) => [row.id, row.name]),
    );
    const squadNumbers = new Map(
      (squadsResult.data ?? []).map((row) => [row.id as string, String(row.squad_number)]),
    );
    const squadsByProfile = new Map<string, string[]>();
    for (const row of mentorSquadsResult.data ?? [])
      squadsByProfile.set(row.profile_id, [...(squadsByProfile.get(row.profile_id) ?? []), row.squad_id]);
    const squadView = (ids: string[]) =>
      ids.map((id) => ({ id, squad_number: squadNumbers.get(id) ?? "?" }));
    const users = (profilesResult.data ?? []).map((profile) => {
      const authUser = authById.get(profile.id);
      return {
        email: authUser?.email ?? "",
        full_name: profile.full_name,
        role: profile.role,
        university_id: profile.university_id,
        university_name: profile.university_id
          ? (universityNames.get(profile.university_id) ?? null)
          : null,
        student_id: profile.student_id,
        student_name: profile.student_id
          ? (studentNames.get(profile.student_id) ?? null)
          : null,
        squads: squadView(squadsByProfile.get(profile.id) ?? []),
        last_seen_at: (profile.last_seen_at as string | null) ?? null,
        last_sign_in_at: authUser?.last_sign_in_at ?? null,
        status: "active" as const,
      };
    });
    const invitations = (invitationsResult.data ?? []).map((invitation) => ({
      email: invitation.email,
      full_name: invitation.full_name,
      role: invitation.role,
      university_id: invitation.university_id,
      university_name: invitation.university_id
        ? (universityNames.get(invitation.university_id) ?? null)
        : null,
      student_id: invitation.student_id,
      student_name: invitation.student_id
        ? (studentNames.get(invitation.student_id) ?? null)
        : null,
      squads: squadView((invitation.squad_ids as string[] | null) ?? []),
      last_seen_at: null,
      last_sign_in_at: null,
      status: "pending" as const,
    }));
    const records = [...users, ...invitations].filter((user) => {
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesSearch =
        !search ||
        `${user.email} ${user.full_name ?? ""}`.toLowerCase().includes(search);
      return matchesRole && matchesSearch;
    });
    return NextResponse.json({
      users: records,
      roles: ASSIGNABLE_ROLES,
      universities: universitiesResult.data ?? [],
      students: studentsResult.data ?? [],
    });
  } catch (error) {
    console.error("Super Admin users GET error:", error);
    return NextResponse.json(
      { error: "Unable to load users" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authorization = await requireSuperAdmin();
  if (authorization.response) return authorization.response;
  try {
    if (!isUuid(authorization.user.id)) {
      throw new Error("Authenticated Super Admin ID is not a valid UUID");
    }
    const body = (await request.json()) as {
      email?: unknown;
      fullName?: unknown;
      role?: unknown;
      universityId?: unknown;
      studentId?: unknown;
      squadIds?: unknown;
    };
    const email = normalizeEmail(body.email);
    const fullName =
      typeof body.fullName === "string" ? body.fullName.trim() : "";
    const role = body.role as AssignableRole;
    const requestedUniversityId =
      typeof body.universityId === "string" ? body.universityId.trim() : "";
    const universityId =
      isGlobalRole(role) ? null : requestedUniversityId || null;
    if (
      !/^\S+@\S+\.\S+$/.test(email) ||
      !fullName ||
      !ASSIGNABLE_ROLES.includes(role)
    ) {
      return NextResponse.json(
        { error: "A valid email, name, and supported role are required" },
        { status: 400 },
      );
    }
    if (
      (isGlobalRole(role) && (body.universityId || body.studentId)) ||
      (!isGlobalRole(role) && !universityId) ||
      (!isGlobalRole(role) && !isUuid(universityId ?? ""))
    ) {
      return NextResponse.json(
        {
          error:
            isGlobalRole(role)
              ? "Super Admin and Developer assignments must not include a university or student record"
              : "A valid university UUID is required for this role",
        },
        { status: 400 },
      );
    }
    if (universityId) {
      const { data, error } = await supabaseAdmin
        .from("universities")
        .select("id")
        .eq("id", universityId)
        .maybeSingle();
      if (error) throw error;
      if (!data)
        return NextResponse.json(
          { error: "University not found" },
          { status: 400 },
        );
    }

    let studentId: string | null = null;
    let studentUniversityId: string | null = null;
    if (role === "student") {
      const requestedStudentId =
        typeof body.studentId === "string" ? body.studentId.trim() : "";
      if (requestedStudentId && isUuid(requestedStudentId)) {
        studentId = requestedStudentId;
      } else {
        const studentEmail = normalizeEmail(requestedStudentId || email);
        if (!/^\S+@\S+\.\S+$/.test(studentEmail)) {
          return NextResponse.json(
            {
              error:
                "Select a student by record UUID or provide a student email",
            },
            { status: 400 },
          );
        }
        const { data: studentByEmail, error: studentByEmailError } =
          await supabaseAdmin
            .from("students")
            .select("id")
            .eq("email", studentEmail)
            .maybeSingle();
        if (studentByEmailError) throw studentByEmailError;
        if (!studentByEmail) {
          return NextResponse.json(
            { error: "No student record matches that email" },
            { status: 400 },
          );
        }
        studentId = studentByEmail.id;
      }

      const [studentResult, membershipResult] = await Promise.all([
        supabaseAdmin
          .from("students")
          .select("id")
          .eq("id", studentId)
          .maybeSingle(),
        supabaseAdmin
          .from("student_memberships")
          .select("squads!inner(university_id)")
          .eq("student_id", studentId)
          .is("end_date", null),
      ]);
      if (studentResult.error) throw studentResult.error;
      if (membershipResult.error) throw membershipResult.error;
      if (!studentResult.data)
        return NextResponse.json(
          { error: "Student record not found" },
          { status: 400 },
        );
      const universityIds = new Set(
        (membershipResult.data ?? [])
          .map((row) => {
            const squad = Array.isArray(row.squads)
              ? row.squads[0]
              : row.squads;
            return squad?.university_id;
          })
          .filter((id): id is string => Boolean(id)),
      );
      if (universityId && !universityIds.has(universityId))
        return NextResponse.json(
          { error: "The student does not belong to the selected university" },
          { status: 400 },
        );
      if (universityIds.size > 1 && !universityId)
        return NextResponse.json(
          { error: "Select the student's university" },
          { status: 400 },
        );
      studentUniversityId = universityId ?? [...universityIds][0] ?? null;
    }

    const authUser = (await listAuthUsers()).find(
      (user) => user.email?.toLowerCase() === email,
    );
    if (authUser && !isUuid(authUser.id)) {
      throw new Error("Authenticated account ID is not a valid UUID");
    }
    // Mentors look after specific squads of their own campus.
    let squadIds: string[] = [];
    if (role === "mentor") {
      const requested = Array.isArray(body.squadIds)
        ? [...new Set(body.squadIds.filter((id): id is string => typeof id === "string" && isUuid(id)))]
        : [];
      if (requested.length) {
        const { data: valid, error: squadError } = await supabaseAdmin
          .from("squads")
          .select("id")
          .in("id", requested)
          .eq("university_id", universityId!);
        if (squadError) throw squadError;
        if ((valid ?? []).length !== requested.length)
          return NextResponse.json(
            { error: "Pick squads from the mentor’s own university" },
            { status: 400 },
          );
      }
      squadIds = requested;
    }

    const assignment = {
      full_name: fullName,
      role,
      university_id: role === "student" ? studentUniversityId : universityId,
      student_id: role === "student" ? studentId : null,
    };

    if (authUser) {
      const { data: previous, error: previousError } = await supabaseAdmin
        .from("profiles")
        .select("role, university_id, student_id")
        .eq("id", authUser.id)
        .maybeSingle();
      if (previousError) throw previousError;
      // Never let admin access disappear: no demoting yourself, and always
      // keep at least one super admin.
      if (isGlobalRole(previous?.role) && !isGlobalRole(role)) {
        if (authUser.id === authorization.user.id)
          return NextResponse.json(
            { error: "You can't remove your own admin access" },
            { status: 400 },
          );
        const { count, error: countError } = await supabaseAdmin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .in("role", ["super_admin", "developer"]);
        if (countError) throw countError;
        if ((count ?? 0) <= 1)
          return NextResponse.json(
            { error: "At least one Super Admin or Developer must remain" },
            { status: 400 },
          );
      }
      const { error } = await supabaseAdmin
        .from("profiles")
        .upsert({ id: authUser.id, ...assignment }, { onConflict: "id" });
      if (error) throw error;
      // Replace the mentor's squads (other roles keep none).
      const { error: clearError } = await supabaseAdmin
        .from("mentor_squads")
        .delete()
        .eq("profile_id", authUser.id);
      if (clearError) throw clearError;
      if (squadIds.length) {
        const { error: squadInsertError } = await supabaseAdmin
          .from("mentor_squads")
          .insert(squadIds.map((squadId) => ({ profile_id: authUser.id, squad_id: squadId })));
        if (squadInsertError) throw squadInsertError;
      }
      const action =
        previous?.role && previous.role !== role
          ? "role_changed"
          : previous
            ? "user_assignment_updated"
            : "user_assigned";
      await writeAuditLog(
        authorization.user.id,
        action,
        "profile",
        authUser.id,
        {
          email,
          previous_role: previous?.role ?? null,
          role,
          university_id: assignment.university_id,
          student_id: assignment.student_id,
        },
      );
      if (studentId && previous?.student_id !== studentId)
        await writeAuditLog(
          authorization.user.id,
          "student_assigned",
          "profile",
          authUser.id,
          { email, student_id: studentId },
        );
      return NextResponse.json({ status: "active", email, role });
    }

    const { error } = await supabaseAdmin.from("user_invitations").upsert(
      {
        email,
        ...assignment,
        squad_ids: squadIds,
        created_by: authorization.user.id,
      },
      { onConflict: "email" },
    );
    if (error) throw error;
    await writeAuditLog(
      authorization.user.id,
      "user_assignment",
      "invitation",
      email,
      {
        email,
        role,
        university_id: assignment.university_id,
        student_id: assignment.student_id,
      },
    );
    return NextResponse.json(
      { status: "pending", email, role },
      { status: 202 },
    );
  } catch (error) {
    console.error("Super Admin users POST error:", error);
    return NextResponse.json(
      { error: "Unable to assign user" },
      { status: 500 },
    );
  }
}

/**
 * Deletes a user: their pending invitation, app profile and sign-in account.
 * For a student user the student record goes too, with its squad membership
 * and every weekly belt record. The body must carry confirm: "DELETE".
 */
export async function DELETE(request: Request) {
  const authorization = await requireSuperAdmin();
  if (authorization.response) return authorization.response;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: unknown;
      confirm?: unknown;
    };
    const email = normalizeEmail(body.email);
    if (!/^\S+@\S+\.\S+$/.test(email))
      return NextResponse.json(
        { error: "A valid email is required" },
        { status: 400 },
      );
    if (body.confirm !== "DELETE")
      return NextResponse.json(
        { error: 'Type "DELETE" to confirm' },
        { status: 400 },
      );
    if (normalizeEmail(authorization.user.email) === email)
      return NextResponse.json(
        { error: "You can't delete your own account" },
        { status: 400 },
      );

    const authUser = (await listAuthUsers()).find(
      (user) => normalizeEmail(user.email) === email,
    );
    const [profileResult, invitationResult] = await Promise.all([
      authUser
        ? supabaseAdmin
            .from("profiles")
            .select("id, role, student_id")
            .eq("id", authUser.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabaseAdmin
        .from("user_invitations")
        .select("email, role, student_id")
        .eq("email", email)
        .maybeSingle(),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (invitationResult.error) throw invitationResult.error;
    const profile = profileResult.data;
    const invitation = invitationResult.data;
    if (!profile && !invitation)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const role = profile?.role ?? invitation?.role ?? null;
    const studentId =
      role === "student"
        ? (profile?.student_id ?? invitation?.student_id ?? null)
        : null;

    async function run(
      step: PromiseLike<{ error: { message: string } | null }>,
    ) {
      const { error } = await step;
      if (error) throw error;
    }

    // Access first, so a half-finished delete never leaves a live login.
    await run(supabaseAdmin.from("user_invitations").delete().eq("email", email));
    if (studentId)
      await run(
        supabaseAdmin.from("user_invitations").delete().eq("student_id", studentId),
      );
    if (authUser)
      await run(supabaseAdmin.from("profiles").delete().eq("id", authUser.id));
    if (studentId) {
      await run(
        supabaseAdmin.from("profiles").delete().eq("student_id", studentId),
      );
      await run(
        supabaseAdmin
          .from("weekly_belt_records")
          .delete()
          .eq("student_id", studentId),
      );
      await run(
        supabaseAdmin
          .from("student_memberships")
          .delete()
          .eq("student_id", studentId),
      );
      await run(supabaseAdmin.from("students").delete().eq("id", studentId));
    }
    if (authUser) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      if (error) throw error;
    }

    await writeAuditLog(
      authorization.user.id,
      "user_deleted",
      studentId ? "student" : "user",
      studentId ?? authUser?.id ?? email,
      { email, role, student_record_deleted: Boolean(studentId) },
    );

    return NextResponse.json({ deleted: true, studentRecordDeleted: Boolean(studentId) });
  } catch (error) {
    console.error("Super admin users DELETE error:", error);
    return NextResponse.json(
      {
        error:
          "Something went wrong on our side. Please try again.",
      },
      { status: 500 },
    );
  }
}
