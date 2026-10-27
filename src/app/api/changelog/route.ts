import { NextResponse } from "next/server";
import { requireDeveloper, requireRoles, writeAuditLog } from "@/lib/auth/authorization";
import { USER_ROLES } from "@/lib/auth/profile";
import { isUuid } from "@/lib/is-uuid";
import { supabaseAdmin } from "@/lib/supabase/server";
import { CHANGELOG_COLUMNS, toEntry, type ChangelogRow as Row } from "@/lib/changelog-server";
import { CHANGELOG_KINDS, cleanText, type ChangelogKind } from "@/lib/support";

/** GET: published release notes for everyone; ?drafts=1 adds drafts for staff. */
export async function GET(request: Request) {
  const authorization = await requireRoles(USER_ROLES);
  if (authorization.response) return authorization.response;
  try {
    // Only developers write release notes, so only they see drafts.
    const isStaff = authorization.profile.is_developer && !authorization.profile.viewing_as;
    const drafts = isStaff && new URL(request.url).searchParams.get("drafts") === "1";
    let query = supabaseAdmin
      .from("changelog_entries")
      .select(CHANGELOG_COLUMNS)
      .order("published_at", { ascending: false, nullsFirst: true })
      .order("created_at", { ascending: false })
      .limit(200);
    if (!drafts) query = query.eq("published", true);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ entries: (data ?? []).map((row) => toEntry(row as Row)), isStaff });
  } catch (error) {
    console.error("Changelog GET error:", error);
    return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
  }
}

/** POST { kind, title, body?, ticketId?, publish? }: add a release note (staff). */
export async function POST(request: Request) {
  const authorization = await requireDeveloper();
  if (authorization.response) return authorization.response;
  try {
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const kind = payload.kind as ChangelogKind;
    const title = cleanText(payload.title);
    const body = cleanText(payload.body, true) || null;
    const ticketId = isUuid(payload.ticketId) ? payload.ticketId : null;
    const publish = payload.publish === true;
    if (!CHANGELOG_KINDS.includes(kind))
      return NextResponse.json({ error: "Pick fix, new or improved" }, { status: 400 });
    if (title.length < 3 || title.length > 140)
      return NextResponse.json({ error: "Give it a title of 3–140 characters" }, { status: 400 });
    if (body && body.length > 2000)
      return NextResponse.json({ error: "Keep the details under 2000 characters" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("changelog_entries")
      .insert({
        kind,
        title,
        body,
        ticket_id: ticketId,
        published: publish,
        published_at: publish ? new Date().toISOString() : null,
        created_by: authorization.user.id,
      })
      .select(CHANGELOG_COLUMNS)
      .single();
    if (error) throw error;
    await writeAuditLog(authorization.user.id, "changelog_added", "changelog", data.id as string, {
      title,
      ticket_id: ticketId,
      published: publish,
    });
    return NextResponse.json({ entry: toEntry(data as Row) }, { status: 201 });
  } catch (error) {
    console.error("Changelog POST error:", error);
    return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
  }
}
