import { NextResponse } from "next/server";
import { requireRoles, writeAuditLog } from "@/lib/auth/authorization";
import { noticeEmail, sendEmail } from "@/lib/email";
import { isUuid } from "@/lib/is-uuid";
import { supabaseAdmin } from "@/lib/supabase/server";
import { cleanText } from "@/lib/support";

type Context = { params: Promise<{ requestId: string }> };
const GRANTABLE = ["student", "mentor", "campus_manager", "super_admin", "developer"] as const;
type Grantable = (typeof GRANTABLE)[number];
const FAILED = () =>
  NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });

/**
 * PATCH { decision: "approve", role, universityId?, studentId?, squadIds?, note? }
 *     | { decision: "reject", note? }
 * Approving creates the person's account straight away, so they're in on
 * their next page load. Either way the requester is emailed.
 */
export async function PATCH(request: Request, context: Context) {
  const authorization = await requireRoles(["super_admin"]);
  if (authorization.response) return authorization.response;
  try {
    const { requestId } = await context.params;
    if (!isUuid(requestId)) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    const { data: accessRequest, error: loadError } = await supabaseAdmin
      .from("access_requests")
      .select("id, user_id, email, full_name, status")
      .eq("id", requestId)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!accessRequest) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if (accessRequest.status !== "pending")
      return NextResponse.json({ error: "This request was already decided" }, { status: 409 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const note = cleanText(body.note, true).slice(0, 500) || null;
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

    if (body.decision === "reject") {
      const { error } = await supabaseAdmin
        .from("access_requests")
        .update({
          status: "rejected",
          decision_note: note,
          decided_by: authorization.user.id,
          decided_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      if (error) throw error;
      await writeAuditLog(authorization.user.id, "access_rejected", "access_request", requestId, {
        email: accessRequest.email,
      });
      await sendEmail(
        [accessRequest.email],
        "About your Dojo Belt Analyzer access request",
        noticeEmail({
          heading: "Your access request wasn’t approved",
          body: note ?? "An admin reviewed your request and couldn’t approve it. Reply to your campus team if you think this is a mistake.",
          link: `${site}/request-access`,
          cta: "View your request",
        }),
      );
      return NextResponse.json({ status: "rejected" });
    }

    if (body.decision !== "approve")
      return NextResponse.json({ error: "Choose approve or reject" }, { status: 400 });

    const role = body.role as Grantable;
    if (!GRANTABLE.includes(role)) return NextResponse.json({ error: "Pick a role to grant" }, { status: 400 });
    if (role === "developer" && !authorization.profile.is_developer)
      return NextResponse.json({ error: "Only developers can grant the Developer role" }, { status: 403 });
    const global = role === "super_admin" || role === "developer";
    const universityId = global ? null : isUuid(body.universityId) ? body.universityId : null;
    if (!global && !universityId)
      return NextResponse.json({ error: "Pick the university for this role" }, { status: 400 });

    // Students are linked to their student record (matched by email unless picked).
    let studentId: string | null = null;
    if (role === "student") {
      if (isUuid(body.studentId)) studentId = body.studentId;
      else {
        const { data: student, error } = await supabaseAdmin
          .from("students")
          .select("id")
          .eq("email", accessRequest.email)
          .maybeSingle();
        if (error) throw error;
        studentId = student?.id ?? null;
      }
      if (!studentId)
        return NextResponse.json(
          { error: "No student record has this email. Add the student (or import their CSV) first." },
          { status: 400 },
        );
    }

    let squadIds: string[] = [];
    if (role === "mentor") {
      squadIds = Array.isArray(body.squadIds) ? body.squadIds.filter((id): id is string => isUuid(id)) : [];
      if (squadIds.length) {
        const { data: valid, error } = await supabaseAdmin
          .from("squads")
          .select("id")
          .in("id", squadIds)
          .eq("university_id", universityId!);
        if (error) throw error;
        if ((valid ?? []).length !== squadIds.length)
          return NextResponse.json({ error: "Pick squads from that university" }, { status: 400 });
      }
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: accessRequest.user_id,
        full_name: accessRequest.full_name,
        role,
        university_id: universityId,
        student_id: studentId,
      },
      { onConflict: "id" },
    );
    if (profileError) throw profileError;
    await supabaseAdmin.from("mentor_squads").delete().eq("profile_id", accessRequest.user_id);
    if (squadIds.length) {
      const { error } = await supabaseAdmin
        .from("mentor_squads")
        .insert(squadIds.map((squadId) => ({ profile_id: accessRequest.user_id, squad_id: squadId })));
      if (error) throw error;
    }
    // An account now exists, so any older pending invitation is moot.
    await supabaseAdmin.from("user_invitations").delete().eq("email", accessRequest.email);

    const { error: updateError } = await supabaseAdmin
      .from("access_requests")
      .update({
        status: "approved",
        decision_note: note,
        decided_by: authorization.user.id,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);
    if (updateError) throw updateError;

    await writeAuditLog(authorization.user.id, "access_approved", "profile", accessRequest.user_id, {
      email: accessRequest.email,
      role,
      university_id: universityId,
    });
    await sendEmail(
      [accessRequest.email],
      "You now have access to Dojo Belt Analyzer",
      noticeEmail({
        heading: "You’re in!",
        body: note ?? "Your access request was approved. Open the app to get started.",
        meta: [["Access", role.replace("_", " ")]],
        link: site,
        cta: "Open Dojo Belt Analyzer",
      }),
    );
    return NextResponse.json({ status: "approved" });
  } catch (error) {
    console.error("Access request PATCH error:", error);
    return FAILED();
  }
}
