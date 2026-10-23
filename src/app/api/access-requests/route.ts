import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth/authorization";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { createRequestSupabaseClient } from "@/lib/auth/server";
import { REQUESTABLE_ROLES, type RequestableRole } from "@/lib/access-requests";
import { noticeEmail, sendEmail, sendSupportEmail } from "@/lib/email";
import { isUuid } from "@/lib/is-uuid";
import { supabaseAdmin } from "@/lib/supabase/server";
import { cleanText } from "@/lib/support";

const COLUMNS =
  "id, email, full_name, requested_role, other_role, university_id, university_name, squad_number, details, status, decision_note, decided_at, created_at";
const FAILED = () =>
  NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });

function origin(request: Request) {
  return process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
}

/**
 * GET ?scope=all: every request, for super admins and developers.
 * GET (default): the signed-in person's latest request, plus the university
 * list for the form. Works for people who have no account yet.
 */
export async function GET(request: Request) {
  try {
    if (new URL(request.url).searchParams.get("scope") === "all") {
      const authorization = await requireRoles(["super_admin"]);
      if (authorization.response) return authorization.response;
      const status = new URL(request.url).searchParams.get("status");
      let query = supabaseAdmin
        .from("access_requests")
        .select(COLUMNS)
        .order("created_at", { ascending: false })
        .limit(200);
      if (status === "pending" || status === "approved" || status === "rejected")
        query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json({ requests: data ?? [] });
    }

    const supabase = await createRequestSupabaseClient();
    const current = await getCurrentUserProfile(supabase);
    if (current.status === "unauthenticated" || !current.user)
      return NextResponse.json({ error: "Sign in first" }, { status: 401 });

    const [mine, universities] = await Promise.all([
      supabaseAdmin
        .from("access_requests")
        .select(COLUMNS)
        .eq("user_id", current.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin.from("universities").select("id, name").order("name"),
    ]);
    if (mine.error) throw mine.error;
    if (universities.error) throw universities.error;
    return NextResponse.json(
      {
        request: mine.data ?? null,
        universities: universities.data ?? [],
        email: current.user.email ?? null,
        hasAccess: current.status === "authenticated",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Access requests GET error:", error);
    return FAILED();
  }
}

/** POST: ask for access. Only for signed-in people without an account. */
export async function POST(request: Request) {
  try {
    const supabase = await createRequestSupabaseClient();
    const current = await getCurrentUserProfile(supabase);
    if (current.status === "unauthenticated" || !current.user)
      return NextResponse.json({ error: "Sign in first" }, { status: 401 });
    if (current.status === "authenticated")
      return NextResponse.json({ error: "You already have access" }, { status: 400 });
    const email = (current.user.email ?? "").toLowerCase();
    if (!email) return NextResponse.json({ error: "Your Google account has no email" }, { status: 400 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const fullName = cleanText(body.fullName);
    const role = body.role as RequestableRole;
    const otherRole = role === "other" ? cleanText(body.otherRole).slice(0, 80) || null : null;
    const universityId = isUuid(body.universityId) ? body.universityId : null;
    const universityName = cleanText(body.universityName).slice(0, 120) || null;
    const squadNumber = cleanText(body.squadNumber).slice(0, 12) || null;
    const details = cleanText(body.details, true).slice(0, 1000) || null;

    if (fullName.length < 2 || fullName.length > 120)
      return NextResponse.json({ error: "Enter your full name" }, { status: 400 });
    if (!REQUESTABLE_ROLES.includes(role))
      return NextResponse.json({ error: "Tell us who you are" }, { status: 400 });
    if (role === "other" && !otherRole)
      return NextResponse.json({ error: "Describe your role" }, { status: 400 });
    if (!universityId && !universityName)
      return NextResponse.json({ error: "Pick or type your university" }, { status: 400 });
    if (squadNumber && !/^\d{1,6}$/.test(squadNumber))
      return NextResponse.json({ error: "Squad number should be digits, e.g. 183" }, { status: 400 });

    let universityLabel = universityName;
    if (universityId) {
      const { data: university, error } = await supabaseAdmin
        .from("universities")
        .select("name")
        .eq("id", universityId)
        .maybeSingle();
      if (error) throw error;
      if (!university) return NextResponse.json({ error: "University not found" }, { status: 400 });
      universityLabel = university.name;
    }

    const record = {
      user_id: current.user.id,
      email,
      full_name: fullName,
      requested_role: role,
      other_role: otherRole,
      university_id: universityId,
      university_name: universityId ? null : universityName,
      squad_number: squadNumber,
      details,
      updated_at: new Date().toISOString(),
    };

    // Editing an open request updates it instead of piling up duplicates.
    const { data: open, error: openError } = await supabaseAdmin
      .from("access_requests")
      .select("id")
      .eq("user_id", current.user.id)
      .eq("status", "pending")
      .maybeSingle();
    if (openError) throw openError;
    const { data: saved, error } = open
      ? await supabaseAdmin.from("access_requests").update(record).eq("id", open.id).select(COLUMNS).single()
      : await supabaseAdmin.from("access_requests").insert(record).select(COLUMNS).single();
    if (error) throw error;

    const roleText = role === "other" ? (otherRole ?? "Other") : role.replace("_", " ");
    const meta: Array<[string, string]> = [
      ["Name", fullName],
      ["Email", email],
      ["Role", roleText],
      ["University", universityLabel ?? "—"],
      ...(squadNumber ? ([["Squad", squadNumber]] as Array<[string, string]>) : []),
    ];
    if (!open)
      await Promise.all([
        sendSupportEmail(
          `Access request: ${fullName} (${roleText})`,
          noticeEmail({
            eyebrow: "Access request",
            heading: `${fullName} wants access`,
            body: details ?? "No details given.",
            meta,
            link: `${origin(request)}/users`,
            cta: "Review in Users",
          }),
        ),
        sendEmail(
          [email],
          "We got your access request",
          noticeEmail({
            heading: "Your request is in",
            body: "Thanks! An admin will review it soon. We’ll email you as soon as you have access.",
            meta,
            link: `${origin(request)}/request-access`,
            cta: "Check your request",
          }),
        ),
      ]);

    return NextResponse.json({ request: saved }, { status: open ? 200 : 201 });
  } catch (error) {
    console.error("Access requests POST error:", error);
    return FAILED();
  }
}
