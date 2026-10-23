import { NextResponse } from "next/server";
import { requireRoles, writeAuditLog } from "@/lib/auth/authorization";
import { USER_ROLES } from "@/lib/auth/profile";
import { isUuid } from "@/lib/is-uuid";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  VIEW_AS_COOKIE,
  VIEW_AS_ROLES,
  serializeViewAs,
  type ViewAs,
  type ViewAsRole,
} from "@/lib/view-as";

const ROLE_LABELS: Record<ViewAsRole, string> = {
  campus_manager: "Campus manager",
  mentor: "Mentor",
  student: "Student",
};
const EIGHT_HOURS = 8 * 60 * 60;

async function requireDeveloper() {
  const authorization = await requireRoles(USER_ROLES);
  if (authorization.response) return authorization;
  if (!authorization.profile.is_developer)
    return {
      response: NextResponse.json({ error: "Only developers can use View as" }, { status: 403 }),
    } as const;
  return authorization;
}

/** GET: who the developer is currently viewing as (null when themselves). */
export async function GET() {
  const authorization = await requireRoles(USER_ROLES);
  if (authorization.response) return NextResponse.json({ viewAs: null, isDeveloper: false });
  return NextResponse.json(
    {
      viewAs: authorization.profile.viewing_as ?? null,
      isDeveloper: authorization.profile.is_developer,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** POST { role, universityId?, studentId? }: start viewing as that role. */
export async function POST(request: Request) {
  const authorization = await requireDeveloper();
  if (authorization.response) return authorization.response;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      role?: unknown;
      universityId?: unknown;
      studentId?: unknown;
      squadIds?: unknown;
    };
    const role = body.role as ViewAsRole;
    if (!VIEW_AS_ROLES.includes(role))
      return NextResponse.json({ error: "Pick campus manager, mentor or student" }, { status: 400 });

    let viewAs: ViewAs;
    if (role === "student") {
      if (!isUuid(body.studentId))
        return NextResponse.json({ error: "Pick a student to view as" }, { status: 400 });
      const { data: student, error } = await supabaseAdmin
        .from("students")
        .select("id, name, student_memberships(squads(university_id, squad_number))")
        .eq("id", body.studentId)
        .maybeSingle();
      if (error) throw error;
      if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
      const memberships = (student.student_memberships ?? []) as Array<{
        squads: { university_id: string; squad_number: string } | Array<{ university_id: string; squad_number: string }> | null;
      }>;
      const squad = memberships
        .map((membership) => (Array.isArray(membership.squads) ? membership.squads[0] : membership.squads))
        .find(Boolean);
      viewAs = {
        role,
        university_id: squad?.university_id ?? null,
        student_id: student.id,
        label: `${ROLE_LABELS.student} · ${student.name ?? "Unnamed"}${squad ? ` · Squad ${squad.squad_number}` : ""}`,
      };
    } else {
      if (!isUuid(body.universityId))
        return NextResponse.json({ error: "Pick a university" }, { status: 400 });
      const { data: university, error } = await supabaseAdmin
        .from("universities")
        .select("id, name")
        .eq("id", body.universityId)
        .maybeSingle();
      if (error) throw error;
      if (!university) return NextResponse.json({ error: "University not found" }, { status: 404 });
      // A mentor sees only the squads picked here, as real mentors do.
      let squadIds: string[] = [];
      let squadLabel = "";
      if (role === "mentor") {
        const requested = Array.isArray(body.squadIds)
          ? body.squadIds.filter((id): id is string => isUuid(id))
          : [];
        if (!requested.length)
          return NextResponse.json({ error: "Pick at least one squad for the mentor view" }, { status: 400 });
        const { data: squads, error: squadError } = await supabaseAdmin
          .from("squads")
          .select("id, squad_number")
          .in("id", requested)
          .eq("university_id", university.id);
        if (squadError) throw squadError;
        squadIds = (squads ?? []).map((squad) => squad.id as string);
        if (!squadIds.length)
          return NextResponse.json({ error: "Those squads aren’t in this university" }, { status: 400 });
        squadLabel = ` · Squad ${(squads ?? []).map((squad) => squad.squad_number).join(", ")}`;
      }
      viewAs = {
        role,
        university_id: university.id,
        student_id: null,
        squad_ids: squadIds,
        label: `${ROLE_LABELS[role]} · ${university.name}${squadLabel}`,
      };
    }

    await writeAuditLog(authorization.user.id, "view_as_started", "role", role, {
      label: viewAs.label,
      university_id: viewAs.university_id,
      student_id: viewAs.student_id,
    });
    const response = NextResponse.json({ viewAs });
    response.cookies.set(VIEW_AS_COOKIE, serializeViewAs(viewAs), {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: EIGHT_HOURS,
    });
    return response;
  } catch (error) {
    console.error("View as POST error:", error);
    return NextResponse.json(
      { error: "Something went wrong on our side. Please try again." },
      { status: 500 },
    );
  }
}

/** DELETE: go back to being yourself. Allowed even while viewing as someone. */
export async function DELETE() {
  const authorization = await requireRoles(USER_ROLES);
  const response = NextResponse.json({ viewAs: null });
  response.cookies.set(VIEW_AS_COOKIE, "", { path: "/", maxAge: 0 });
  if (!authorization.response && authorization.profile.viewing_as)
    await writeAuditLog(authorization.user.id, "view_as_ended", "role", authorization.profile.viewing_as.role, {
      label: authorization.profile.viewing_as.label,
    });
  return response;
}
