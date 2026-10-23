import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth/authorization";
import { USER_ROLES } from "@/lib/auth/profile";
import { isUuid } from "@/lib/is-uuid";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  avatarsFor,
  emailReporterStatus,
  listStaff,
  loadVisibleTicket,
  siteOrigin,
} from "@/lib/support-server";
import { isSeverity, isTicketStatus, type TicketStatus } from "@/lib/support";

type Context = { params: Promise<{ ticketId: string }> };

const NOT_FOUND = () => NextResponse.json({ error: "Ticket not found" }, { status: 404 });
const FAILED = () =>
  NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });

/**
 * GET: the ticket and its thread. With ?after=<ISO time> only newer messages
 * come back, so open pages can poll cheaply for live updates. Internal staff
 * notes are left out for reporters.
 */
export async function GET(request: Request, context: Context) {
  const authorization = await requireRoles(USER_ROLES);
  if (authorization.response) return authorization.response;
  try {
    const { ticketId } = await context.params;
    const isStaff = authorization.profile.role === "super_admin";
    const ticket = await loadVisibleTicket(ticketId, authorization.user.id, isStaff);
    if (!ticket) return NOT_FOUND();

    const after = new URL(request.url).searchParams.get("after");
    let query = supabaseAdmin
      .from("support_messages")
      .select("id, author_id, author_name, is_staff, is_internal, body, created_at")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });
    if (!isStaff) query = query.eq("is_internal", false);
    if (after && !Number.isNaN(Date.parse(after))) query = query.gt("created_at", after);
    const { data: messages, error } = await query;
    if (error) throw error;

    const { user_id: ownerId, user_agent: userAgent, ...rest } = ticket;
    const avatars = await avatarsFor([
      after ? null : ownerId,
      ...(messages ?? []).map((message) => message.author_id),
    ]);
    return NextResponse.json(
      {
        ticket: { ...rest, user_agent: isStaff ? userAgent : null, reporter_avatar: avatars[ownerId] ?? null },
        messages: (messages ?? []).map(({ author_id: authorId, ...message }) => ({
          ...message,
          author_avatar: authorId ? (avatars[authorId] ?? null) : null,
          mine: authorId === authorization.user.id,
        })),
        isStaff,
        // Only developers write release notes.
        isDeveloper: authorization.profile.is_developer && !authorization.profile.viewing_as,
        isOwner: ownerId === authorization.user.id,
        staff: isStaff && !after ? await listStaff() : undefined,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Support ticket GET error:", error);
    return FAILED();
  }
}

/**
 * PATCH { status?, severity?, assignedTo? }: super admins and developers can
 * change all three. The reporter can only close their ticket, or reopen it
 * once it is resolved or closed. Resolving or closing emails the reporter.
 */
export async function PATCH(request: Request, context: Context) {
  const authorization = await requireRoles(USER_ROLES);
  if (authorization.response) return authorization.response;
  try {
    const { ticketId } = await context.params;
    const isStaff = authorization.profile.role === "super_admin";
    const ticket = await loadVisibleTicket(ticketId, authorization.user.id, isStaff);
    if (!ticket) return NOT_FOUND();

    const body = (await request.json().catch(() => ({}))) as {
      status?: unknown;
      severity?: unknown;
      assignedTo?: unknown;
    };
    const update: Record<string, unknown> = {};

    if (body.status !== undefined) {
      if (!isTicketStatus(body.status))
        return NextResponse.json({ error: "Unknown status" }, { status: 400 });
      const next: TicketStatus = body.status;
      const ownerMove =
        next === "closed" ||
        (next === "open" && (ticket.status === "resolved" || ticket.status === "closed"));
      if (!isStaff && !ownerMove)
        return NextResponse.json({ error: "Only the support team can set that status" }, { status: 403 });
      update.status = next;
      update.resolved_at = next === "resolved" || next === "closed" ? new Date().toISOString() : null;
    }

    if (body.severity !== undefined || body.assignedTo !== undefined) {
      if (!isStaff)
        return NextResponse.json({ error: "Only the support team can triage tickets" }, { status: 403 });
      if (body.severity !== undefined) {
        if (body.severity !== null && !isSeverity(body.severity))
          return NextResponse.json({ error: "Unknown severity" }, { status: 400 });
        update.severity = body.severity;
      }
      if (body.assignedTo !== undefined) {
        if (body.assignedTo !== null) {
          const staff = await listStaff();
          if (!isUuid(body.assignedTo) || !staff.some((member) => member.id === body.assignedTo))
            return NextResponse.json({ error: "Assign it to someone on the support team" }, { status: 400 });
        }
        update.assigned_to = body.assignedTo;
      }
    }

    if (Object.keys(update).length === 0)
      return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
    update.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .update(update)
      .eq("id", ticket.id)
      .select("status, severity, assigned_to, resolved_at, updated_at")
      .single();
    if (error) throw error;

    // The reporter hears when the team finishes their ticket.
    const finished = data.status === "resolved" || data.status === "closed";
    if (isStaff && update.status && finished && data.status !== ticket.status && ticket.user_id !== authorization.user.id)
      await emailReporterStatus(ticket, data.status as TicketStatus, siteOrigin(request));

    return NextResponse.json({ ticket: data });
  } catch (error) {
    console.error("Support ticket PATCH error:", error);
    return FAILED();
  }
}
