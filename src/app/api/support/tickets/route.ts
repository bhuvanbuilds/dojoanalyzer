import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth/authorization";
import { USER_ROLES } from "@/lib/auth/profile";
import { sendSupportEmail, ticketEmail } from "@/lib/email";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  LIMITS,
  cleanText,
  isSeverity,
  isTicketStatus,
  isTicketType,
} from "@/lib/support";

const TICKET_COLUMNS =
  "id, number, type, title, description, severity, status, page_url, reporter_email, reporter_name, reporter_role, created_at, updated_at, support_messages(count)";

type Row = Record<string, unknown> & { support_messages?: Array<{ count: number }> };

function withCount(row: Row) {
  const { support_messages: messages, ...ticket } = row;
  return { ...ticket, message_count: messages?.[0]?.count ?? 0 };
}

/**
 * GET: your own tickets. Super admins pass scope=all to see every ticket,
 * with optional status, type and q (title or reporter) filters.
 */
export async function GET(request: Request) {
  const authorization = await requireRoles(USER_ROLES);
  if (authorization.response) return authorization.response;
  try {
    const params = new URL(request.url).searchParams;
    const isStaff = authorization.profile.role === "super_admin";
    const all = isStaff && params.get("scope") === "all";
    const status = params.get("status");
    const type = params.get("type");
    const q = cleanText(params.get("q")).slice(0, 80);

    let query = supabaseAdmin
      .from("support_tickets")
      .select(TICKET_COLUMNS)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (!all) query = query.eq("user_id", authorization.user.id);
    if (isTicketStatus(status)) query = query.eq("status", status);
    if (isTicketType(type)) query = query.eq("type", type);
    if (q) {
      // Strip characters that would break PostgREST's or() filter syntax.
      const term = q.replace(/[%,()*]/g, " ");
      query = query.or(
        `title.ilike.%${term}%,reporter_email.ilike.%${term}%,reporter_name.ilike.%${term}%`,
      );
    }
    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      tickets: (data ?? []).map((row) => withCount(row as Row)),
      isStaff,
    });
  } catch (error) {
    console.error("Support tickets GET error:", error);
    return NextResponse.json(
      { error: "Something went wrong on our side. Please try again." },
      { status: 500 },
    );
  }
}

/** POST: file a new ticket as the signed-in user. */
export async function POST(request: Request) {
  const authorization = await requireRoles(USER_ROLES);
  if (authorization.response) return authorization.response;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const type = body.type;
    const title = cleanText(body.title);
    const description = cleanText(body.description, true);
    const severity = type === "bug" && isSeverity(body.severity) ? body.severity : null;
    const pageUrl = cleanText(body.pageUrl).slice(0, 500) || null;
    const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 400) || null;

    if (!isTicketType(type))
      return NextResponse.json({ error: "Choose what kind of ticket this is" }, { status: 400 });
    if (title.length < LIMITS.titleMin || title.length > LIMITS.titleMax)
      return NextResponse.json(
        { error: `Give it a title of ${LIMITS.titleMin}–${LIMITS.titleMax} characters` },
        { status: 400 },
      );
    if (description.length < LIMITS.descriptionMin || description.length > LIMITS.descriptionMax)
      return NextResponse.json(
        {
          error: `Describe it in ${LIMITS.descriptionMin}–${LIMITS.descriptionMax} characters`,
        },
        { status: 400 },
      );

    // A light brake on accidental floods or scripted spam.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabaseAdmin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authorization.user.id)
      .gte("created_at", since);
    if (countError) throw countError;
    if ((count ?? 0) >= LIMITS.ticketsPerDay)
      return NextResponse.json(
        { error: "You've filed a lot of tickets today. Please add to an existing one instead." },
        { status: 429 },
      );

    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        user_id: authorization.user.id,
        reporter_email: (authorization.user.email ?? "").toLowerCase(),
        reporter_name: authorization.profile.full_name ?? null,
        reporter_role: authorization.profile.role,
        university_id: authorization.profile.university_id,
        type,
        title,
        description,
        severity,
        page_url: pageUrl,
        user_agent: userAgent,
      })
      .select("id, number")
      .single();
    if (error) throw error;

    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    const kind = type === "feature" ? "Feature idea" : type === "bug" ? "Bug report" : "Other issue";
    await sendSupportEmail(
      `[${kind}] #${data.number} ${title}`,
      ticketEmail({
        heading: `New ${kind.toLowerCase()}`,
        ticketNumber: data.number,
        title,
        body: description,
        meta: [
          ["From", `${authorization.profile.full_name ?? ""} <${authorization.user.email ?? "unknown"}>`.trim()],
          ["Role", authorization.profile.is_developer ? "developer" : authorization.profile.role],
          ...(severity ? ([["Severity", severity]] as Array<[string, string]>) : []),
          ...(pageUrl ? ([["Page", pageUrl]] as Array<[string, string]>) : []),
        ],
        link: `${origin}/support/${data.id}`,
      }),
    );

    return NextResponse.json({ ticket: data }, { status: 201 });
  } catch (error) {
    console.error("Support tickets POST error:", error);
    return NextResponse.json(
      { error: "Something went wrong on our side. Please try again." },
      { status: 500 },
    );
  }
}
