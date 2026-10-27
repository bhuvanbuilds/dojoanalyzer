import { NextResponse } from "next/server";
import { requireDeveloper, writeAuditLog } from "@/lib/auth/authorization";
import { CHANGELOG_COLUMNS, toEntry, type ChangelogRow } from "@/lib/changelog-server";
import { isUuid } from "@/lib/is-uuid";
import { supabaseAdmin } from "@/lib/supabase/server";
import { CHANGELOG_KINDS, cleanText, type ChangelogKind } from "@/lib/support";

type Context = { params: Promise<{ entryId: string }> };
const FAILED = () =>
  NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });

/** PATCH { published?, title?, body?, kind? }: edit or (un)publish a note. */
export async function PATCH(request: Request, context: Context) {
  const authorization = await requireDeveloper();
  if (authorization.response) return authorization.response;
  try {
    const { entryId } = await context.params;
    if (!isUuid(entryId)) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const update: Record<string, unknown> = {};
    if (typeof payload.published === "boolean") {
      update.published = payload.published;
      update.published_at = payload.published ? new Date().toISOString() : null;
    }
    if (payload.title !== undefined) {
      const title = cleanText(payload.title);
      if (title.length < 3 || title.length > 140)
        return NextResponse.json({ error: "Give it a title of 3–140 characters" }, { status: 400 });
      update.title = title;
    }
    if (payload.body !== undefined) {
      const body = cleanText(payload.body, true) || null;
      if (body && body.length > 2000)
        return NextResponse.json({ error: "Keep the details under 2000 characters" }, { status: 400 });
      update.body = body;
    }
    if (payload.kind !== undefined) {
      if (!CHANGELOG_KINDS.includes(payload.kind as ChangelogKind))
        return NextResponse.json({ error: "Pick fix, new or improved" }, { status: 400 });
      update.kind = payload.kind;
    }
    if (Object.keys(update).length === 0)
      return NextResponse.json({ error: "Nothing to change" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("changelog_entries")
      .update(update)
      .eq("id", entryId)
      .select(CHANGELOG_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    if (typeof payload.published === "boolean")
      await writeAuditLog(
        authorization.user.id,
        payload.published ? "changelog_published" : "changelog_unpublished",
        "changelog",
        entryId,
        { title: data.title },
      );
    return NextResponse.json({ entry: toEntry(data as ChangelogRow) });
  } catch (error) {
    console.error("Changelog PATCH error:", error);
    return FAILED();
  }
}

/** DELETE: remove a release note. */
export async function DELETE(_request: Request, context: Context) {
  const authorization = await requireDeveloper();
  if (authorization.response) return authorization.response;
  try {
    const { entryId } = await context.params;
    if (!isUuid(entryId)) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    const { error } = await supabaseAdmin.from("changelog_entries").delete().eq("id", entryId);
    if (error) throw error;
    await writeAuditLog(authorization.user.id, "changelog_deleted", "changelog", entryId);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Changelog DELETE error:", error);
    return FAILED();
  }
}
