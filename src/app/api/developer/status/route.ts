import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth/authorization";
import { USER_ROLES } from "@/lib/auth/profile";
import { getMaintenance } from "@/lib/maintenance";
import { supabaseAdmin } from "@/lib/supabase/server";

async function count(table: string, filter?: (query: never) => unknown) {
  const started = Date.now();
  let query = supabaseAdmin.from(table).select("*", { count: "exact", head: true });
  if (filter) query = filter(query as never) as typeof query;
  const { count: rows, error } = await query;
  return { ok: !error, rows: rows ?? 0, ms: Date.now() - started, error: error?.message ?? null };
}

/** GET: health and environment for the developer console. Developers only. */
export async function GET() {
  const authorization = await requireRoles(USER_ROLES);
  if (authorization.response) return authorization.response;
  if (!authorization.profile.is_developer)
    return NextResponse.json({ error: "Developers only" }, { status: 403 });

  const [students, weeks, imports, profiles, invitations, tickets, openTickets, settings, maintenance, latestImport] =
    await Promise.all([
      count("students"),
      count("weeks"),
      count("imports"),
      count("profiles"),
      count("user_invitations"),
      count("support_tickets"),
      count("support_tickets", (query: { in: (column: string, values: string[]) => unknown }) =>
        query.in("status", ["open", "in_progress"]),
      ),
      count("app_settings"),
      getMaintenance({ fresh: true }),
      supabaseAdmin
        .from("imports")
        .select("file_name, uploaded_at, status")
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return NextResponse.json(
    {
      environment: {
        mode: process.env.NODE_ENV,
        deployment: process.env.VERCEL_ENV ?? "local",
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
        supabaseProject: supabaseUrl.replace(/^https:\/\//, "").split(".")[0] || null,
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? null,
      },
      checks: {
        database: { ok: students.ok, ms: students.ms },
        supportTables: { ok: tickets.ok, error: tickets.error },
        settingsTable: { ok: settings.ok, error: settings.error },
        email: {
          ok: Boolean(process.env.RESEND_API_KEY && process.env.SUPPORT_EMAIL_TO),
          to: process.env.SUPPORT_EMAIL_TO ?? null,
        },
      },
      counts: {
        students: students.rows,
        weeks: weeks.rows,
        imports: imports.rows,
        accounts: profiles.rows,
        invitations: invitations.rows,
        tickets: tickets.rows,
        openTickets: openTickets.rows,
      },
      maintenance,
      latestImport: latestImport.data ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
