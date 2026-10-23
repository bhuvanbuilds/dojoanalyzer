import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth/authorization";
import { USER_ROLES } from "@/lib/auth/profile";
import { sendSupportEmail, ticketEmail } from "@/lib/email";
import { supabaseAdmin } from "@/lib/supabase/server";
import { LIMITS, cleanText } from "@/lib/support";
import { avatarsFor, emailReporterReply, loadVisibleTicket, siteOrigin } from "@/lib/support-server";

type Context = { params: Promise<{ ticketId: string }> };

/**
 * POST { body }: add a reply to the thread. A staff reply moves an open
 * ticket to in progress; a reporter replying to a resolved or closed ticket
 * reopens it, so nothing they say goes unseen.
 */
export async function POST(request: Request, context: Context) {
  const authorization = await requireRoles(USER_ROLES);
  if (authorization.response) return authorization.response;
  try {
    const { ticketId } = await context.params;
    const isStaff = authorization.profile.role === "super_admin";
    const ticket = await loadVisibleTicket(ticketId, authorization.user.id, isStaff);
    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    const payload = (await request.json().catch(() => ({}))) as {
      body?: unknown;
      internal?: unknown;
    };
    // Internal notes are for the support team only.
    const internal = isStaff && payload.internal === true;
    const body = cleanText(payload.body, true);
    if (!body || body.length > LIMITS.messageMax)
      return NextResponse.json(
        { error: `Write a reply of up to ${LIMITS.messageMax} characters` },
        { status: 400 },
      );

    const { data: message, error } = await supabaseAdmin
      .from("support_messages")
      .insert({
        ticket_id: ticket.id,
        author_id: authorization.user.id,
        author_name: authorization.profile.full_name ?? authorization.user.email ?? null,
        is_staff: isStaff,
        is_internal: internal,
        body,
      })
      .select("id, author_name, is_staff, is_internal, body, created_at")
      .single();
    if (error) throw error;

    // A note changes nothing for the reporter, so it leaves the status alone.
    const status = internal
      ? ticket.status
      : isStaff && ticket.status === "open"
        ? "in_progress"
        : !isStaff && (ticket.status === "resolved" || ticket.status === "closed")
          ? "open"
          : ticket.status;
    const { error: updateError } = await supabaseAdmin
      .from("support_tickets")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", ticket.id);
    if (updateError) throw updateError;

    // The reporter hears about team replies (never internal notes) by email.
    if (isStaff && !internal && ticket.user_id !== authorization.user.id)
      await emailReporterReply(
        ticket,
        body,
        authorization.profile.full_name ?? "The support team",
        siteOrigin(request),
      );

    // The team hears about reporter replies.
    if (!isStaff) {
      const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
      await sendSupportEmail(
        `Re: #${ticket.number} ${ticket.title}`,
        ticketEmail({
          heading: status !== ticket.status ? "Reopened with a new reply" : "New reply",
          ticketNumber: ticket.number,
          title: ticket.title,
          body,
          meta: [["From", ticket.reporter_email]],
          link: `${origin}/support/${ticket.id}`,
        }),
      );
    }

    const avatars = await avatarsFor([authorization.user.id]);
    return NextResponse.json(
      { message: { ...message, author_avatar: avatars[authorization.user.id] ?? null, mine: true }, status },
      { status: 201 },
    );
  } catch (error) {
    console.error("Support message POST error:", error);
    return NextResponse.json(
      { error: "Something went wrong on our side. Please try again." },
      { status: 500 },
    );
  }
}
