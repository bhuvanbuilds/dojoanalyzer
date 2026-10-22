import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth/authorization";
import { USER_ROLES } from "@/lib/auth/profile";
import { supabaseAdmin } from "@/lib/supabase/server";
import { loadVisibleTicket } from "@/lib/support-server";
import { isTicketStatus, type TicketStatus } from "@/lib/support";

type Context = { params: Promise<{ ticketId: string }> };

const NOT_FOUND = () => NextResponse.json({ error: "Ticket not found" }, { status: 404 });

export async function GET(_request: Request, context: Context) {
  const authorization = await requireRoles(USER_ROLES);
  if (authorization.response) return authorization.response;
  try {
    const { ticketId } = await context.params;
    const isStaff = authorization.profile.role === "super_admin";
    const ticket = await loadVisibleTicket(ticketId, authorization.user.id, isStaff);
    if (!ticket) return NOT_FOUND();

    const { data: messages, error } = await supabaseAdmin
      .from("support_messages")
      .select("id, author_id, author_name, is_staff, body, created_at")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });
    if (error) throw error;

    const { user_id: ownerId, user_agent: userAgent, ...rest } = ticket;
    return NextResponse.json({
      ticket: { ...rest, user_agent: isStaff ? userAgent : null },
      messages: (messages ?? []).map(({ author_id: authorId, ...message }) => ({
        ...message,
        mine: authorId === authorization.user.id,
      })),
      isStaff,
      isOwner: ownerId === authorization.user.id,
    });
  } catch (error) {
    console.error("Support ticket GET error:", error);
    return NextResponse.json(
      { error: "Something went wrong on our side. Please try again." },
      { status: 500 },
    );
  }
}

/**
 * PATCH { status }: super admins can set any status. The reporter can only
 * close their ticket, or reopen it once it is resolved or closed.
 */
export async function PATCH(request: Request, context: Context) {
  const authorization = await requireRoles(USER_ROLES);
  if (authorization.response) return authorization.response;
  try {
    const { ticketId } = await context.params;
    const isStaff = authorization.profile.role === "super_admin";
    const ticket = await loadVisibleTicket(ticketId, authorization.user.id, isStaff);
    if (!ticket) return NOT_FOUND();

    const body = (await request.json().catch(() => ({}))) as { status?: unknown };
    if (!isTicketStatus(body.status))
      return NextResponse.json({ error: "Unknown status" }, { status: 400 });
    const next: TicketStatus = body.status;
    const ownerMove =
      next === "closed" ||
      (next === "open" && (ticket.status === "resolved" || ticket.status === "closed"));
    if (!isStaff && !ownerMove)
      return NextResponse.json(
        { error: "Only the support team can set that status" },
        { status: 403 },
      );

    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", ticket.id)
      .select("status, updated_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ ticket: data });
  } catch (error) {
    console.error("Support ticket PATCH error:", error);
    return NextResponse.json(
      { error: "Something went wrong on our side. Please try again." },
      { status: 500 },
    );
  }
}
