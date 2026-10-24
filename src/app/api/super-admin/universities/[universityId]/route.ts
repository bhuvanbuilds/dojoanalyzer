import { NextResponse } from "next/server";
import { requireSuperAdmin, writeAuditLog } from "@/lib/auth/authorization";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isUuid } from "@/lib/is-uuid";

type Context = { params: Promise<{ universityId: string }> };

export async function GET(_request: Request, context: Context) {
  const authorization = await requireSuperAdmin();
  if (authorization.response) return authorization.response;
  try {
    const { universityId } = await context.params;
    if (!isUuid(universityId))
      return NextResponse.json({ error: "University not found" }, { status: 404 });
    const [university, squads, memberships, profiles] = await Promise.all([
      supabaseAdmin
        .from("universities")
        .select("id, name")
        .eq("id", universityId)
        .maybeSingle(),
      supabaseAdmin
        .from("squads")
        .select("squad_number")
        .eq("university_id", universityId)
        .order("squad_number"),
      supabaseAdmin
        .from("student_memberships")
        .select("student_id, squads!inner(university_id)")
        .eq("squads.university_id", universityId)
        .is("end_date", null),
      supabaseAdmin
        .from("profiles")
        .select("full_name, role")
        .eq("university_id", universityId),
    ]);
    for (const result of [university, squads, memberships, profiles])
      if (result.error) throw result.error;
    if (!university.data)
      return NextResponse.json(
        { error: "University not found" },
        { status: 404 },
      );
    const profileRows = profiles.data ?? [];
    return NextResponse.json({
      university: university.data,
      squads: squads.data ?? [],
      counts: {
        students: new Set((memberships.data ?? []).map((row) => row.student_id))
          .size,
        squads: squads.data?.length ?? 0,
        mentors: profileRows.filter((row) => row.role === "mentor").length,
        campus_managers: profileRows.filter(
          (row) => row.role === "campus_manager",
        ).length,
      },
      users: profileRows.filter(
        (row) => row.role === "mentor" || row.role === "campus_manager",
      ),
    });
  } catch (error) {
    console.error("Super Admin university detail GET error:", error);
    return NextResponse.json(
      { error: "Unable to load university details" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: Context) {
  const authorization = await requireSuperAdmin();
  if (authorization.response) return authorization.response;
  try {
    const { universityId } = await context.params;
    if (!isUuid(universityId))
      return NextResponse.json({ error: "University not found" }, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as { name?: unknown; alias?: unknown };
    const name =
      typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    if (!name || name.length > 120)
      return NextResponse.json(
        { error: "A university name of up to 120 characters is required" },
        { status: 400 },
      );
    // Short name shown across the app; empty clears it back to the full name.
    const alias =
      typeof body.alias === "string" ? body.alias.trim().replace(/\s+/g, " ") || null : undefined;
    if (alias && alias.length > 24)
      return NextResponse.json({ error: "Keep the alias to 24 characters or fewer" }, { status: 400 });
    const { data, error } = await supabaseAdmin
      .from("universities")
      .update(alias === undefined ? { name } : { name, alias })
      .eq("id", universityId)
      .select("id, name, alias")
      .maybeSingle();
    if (error?.code === "23505")
      return NextResponse.json(
        { error: "That name or alias is already used by another university" },
        { status: 409 },
      );
    if (error) throw error;
    if (!data)
      return NextResponse.json(
        { error: "University not found" },
        { status: 404 },
      );
    await writeAuditLog(
      authorization.user.id,
      "university_updated",
      "university",
      data.id,
      { name, alias: data.alias },
    );
    return NextResponse.json({ university: data });
  } catch (error) {
    console.error("Super Admin university PATCH error:", error);
    return NextResponse.json(
      { error: "Unable to update university" },
      { status: 500 },
    );
  }
}
