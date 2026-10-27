import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/authorization";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const authorization = await requireSuperAdmin();
  if (authorization.response) return authorization.response;
  try {
    const [
      universities,
      students,
      squads,
      managers,
      mentors,
      latestImport,
      activity,
      profiles,
    ] = await Promise.all([
      supabaseAdmin
        .from("universities")
        .select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("students")
        .select("id", { count: "exact", head: true }),
      supabaseAdmin.from("squads").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "campus_manager"),
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "mentor"),
      supabaseAdmin
        .from("imports")
        .select(
          "id, file_name, uploaded_at, weeks!inner(academic_year, week_number)",
        )
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("audit_logs")
        .select("actor_user_id, action, target_type, created_at, metadata")
        // Per-student rows from a CSV would drown everything else out.
        .not("action", "in", "(student_created,student_assignment)")
        .order("created_at", { ascending: false })
        .limit(8),
      supabaseAdmin.from("profiles").select("id, full_name"),
    ]);
    for (const result of [
      universities,
      students,
      squads,
      managers,
      mentors,
      latestImport,
      activity,
      profiles,
    ])
      if (result.error) throw result.error;

    const { data: beltRecords, error: beltError } = await supabaseAdmin
      .from("weekly_belt_records")
      .select("final_belt_levels, imports!inner(is_current, status)")
      .eq("imports.is_current", true)
      .eq("imports.status", "imported");
    if (beltError) throw beltError;
    const distribution = { cpp: 0, java: 0, nodejs: 0, python: 0 };
    for (const record of beltRecords ?? []) {
      const values = record.final_belt_levels as Record<string, unknown> | null;
      for (const language of Object.keys(distribution) as Array<
        keyof typeof distribution
      >) {
        const level = Number(values?.[language]);
        if (Number.isFinite(level)) distribution[language] += level;
      }
    }
    // Added since the first of this month, for the "+2 this month" lines.
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const since = monthStart.toISOString();
    const [newUniversities, newSquads, newManagers, newMentors, universityNames] = await Promise.all([
      supabaseAdmin.from("universities").select("id", { count: "exact", head: true }).gte("created_at", since),
      supabaseAdmin.from("squads").select("id", { count: "exact", head: true }).gte("created_at", since),
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "campus_manager")
        .gte("created_at", since),
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "mentor")
        .gte("created_at", since),
      supabaseAdmin.from("universities").select("id, name:display_name"),
    ]);
    for (const result of [newUniversities, newSquads, newManagers, newMentors, universityNames])
      if (result.error) throw result.error;
    const campus = new Map((universityNames.data ?? []).map((row) => [row.id as string, row.name as string]));
    const ROLE: Record<string, string> = {
      super_admin: "Super Admin",
      developer: "Developer",
      campus_manager: "Campus Manager",
      mentor: "Mentor",
      student: "Student",
    };
    /** One plain line under each activity, from its stored metadata. */
    function detailOf(action: string, raw: unknown) {
      const m = (raw ?? {}) as Record<string, unknown>;
      const text = (value: unknown) => (typeof value === "string" || typeof value === "number" ? String(value) : "");
      const uni = text(m.university_id) ? campus.get(text(m.university_id)) : undefined;
      const parts: string[] = [];
      switch (action) {
        case "import_completed":
          if (m.week_number) parts.push(`Week ${text(m.week_number)}${m.academic_year ? `, ${text(m.academic_year)}` : ""}`);
          if (m.row_count) parts.push(`${text(m.row_count)} records`);
          break;
        case "students_provisioned_from_csv":
          if (m.unique_student_count) parts.push(`${text(m.unique_student_count)} students`);
          if (Number(m.error_count) > 0) parts.push(`${text(m.error_count)} errors`);
          break;
        case "university_created":
        case "university_updated":
          parts.push([text(m.name), text(m.alias) ? `(${text(m.alias)})` : ""].filter(Boolean).join(" "));
          break;
        case "squad_created":
          if (m.squad_number) parts.push(`Squad ${text(m.squad_number)}`);
          break;
        case "role_changed":
          parts.push(text(m.email));
          if (m.previous_role && m.role) parts.push(`${ROLE[text(m.previous_role)] ?? text(m.previous_role)} → ${ROLE[text(m.role)] ?? text(m.role)}`);
          break;
        case "changelog_added":
        case "changelog_unpublished":
          parts.push(text(m.title));
          break;
        default:
          parts.push(text(m.email));
          if (m.role) parts.push(ROLE[text(m.role)] ?? text(m.role));
      }
      if (uni) parts.push(uni);
      return parts.filter(Boolean).join(" · ");
    }

    const actorNames = new Map(
      (profiles.data ?? []).map((profile) => [profile.id, profile.full_name]),
    );
    return NextResponse.json({
      totals: {
        universities: universities.count ?? 0,
        students: students.count ?? 0,
        squads: squads.count ?? 0,
        campus_managers: managers.count ?? 0,
        mentors: mentors.count ?? 0,
      },
      thisMonth: {
        universities: newUniversities.count ?? 0,
        squads: newSquads.count ?? 0,
        campus_managers: newManagers.count ?? 0,
        mentors: newMentors.count ?? 0,
      },
      latestImport: latestImport.data
        ? {
            file_name: latestImport.data.file_name,
            uploaded_at: latestImport.data.uploaded_at,
            week: Array.isArray(latestImport.data.weeks)
              ? latestImport.data.weeks[0]
              : latestImport.data.weeks,
          }
        : null,
      distribution,
      recentActivity: (activity.data ?? []).map((entry) => ({
        actor: entry.actor_user_id
          ? (actorNames.get(entry.actor_user_id) ?? "Administrator")
          : "System",
        action: entry.action,
        target_type: entry.target_type,
        detail: detailOf(entry.action, entry.metadata),
        created_at: entry.created_at,
      })),
    });
  } catch (error) {
    console.error("Super Admin dashboard error:", error);
    return NextResponse.json(
      { error: "Unable to load global overview" },
      { status: 500 },
    );
  }
}
