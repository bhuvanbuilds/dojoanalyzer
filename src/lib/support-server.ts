import "server-only";
import { sendEmail, ticketEmail } from "@/lib/email";
import { isUuid } from "@/lib/is-uuid";
import { supabaseAdmin } from "@/lib/supabase/server";
import { STATUS_LABELS, type StaffMember, type TicketStatus } from "@/lib/support";

export const TICKET_DETAIL_COLUMNS =
  "id, number, user_id, type, title, description, severity, status, page_url, user_agent, reporter_email, reporter_name, reporter_role, assigned_to, resolved_at, created_at, updated_at";

/** Loads a ticket the caller may see: their own, or any for super admins. */
export async function loadVisibleTicket(ticketId: string, userId: string, isStaff: boolean) {
  if (!isUuid(ticketId)) return null;
  const { data, error } = await supabaseAdmin
    .from("support_tickets")
    .select(TICKET_DETAIL_COLUMNS)
    .eq("id", ticketId)
    .maybeSingle();
  if (error) throw error;
  if (!data || (!isStaff && data.user_id !== userId)) return null;
  return data;
}

/** Everyone who can work tickets: super admins and developers. */
export async function listStaff(): Promise<StaffMember[]> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name")
    .in("role", ["super_admin", "developer"]);
  if (error) throw error;
  const emails = new Map<string, string | null>();
  const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  for (const user of users?.users ?? []) emails.set(user.id, user.email ?? null);
  return (data ?? [])
    .map((row) => ({
      id: row.id as string,
      name: (row.full_name as string | null) ?? emails.get(row.id as string) ?? "Staff",
      email: emails.get(row.id as string) ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function siteOrigin(request: Request) {
  return process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
}

type Ticket = { id: string; number: number; title: string; reporter_email: string };

/** Lets the reporter know the team replied. Never throws. */
export async function emailReporterReply(ticket: Ticket, body: string, author: string, origin: string) {
  await sendEmail(
    [ticket.reporter_email],
    `Re: #${ticket.number} ${ticket.title}`,
    ticketEmail({
      heading: `${author} replied to your ticket`,
      ticketNumber: ticket.number,
      title: ticket.title,
      body,
      meta: [["Reply from", `${author} · Kalvium support`]],
      link: `${origin}/support/${ticket.id}`,
    }),
  );
}

/** Lets the reporter know their ticket was resolved or closed. Never throws. */
export async function emailReporterStatus(ticket: Ticket, status: TicketStatus, origin: string) {
  const resolved = status === "resolved";
  await sendEmail(
    [ticket.reporter_email],
    `${resolved ? "Resolved" : "Closed"}: #${ticket.number} ${ticket.title}`,
    ticketEmail({
      heading: `Your ticket is now ${STATUS_LABELS[status].toLowerCase()}`,
      ticketNumber: ticket.number,
      title: ticket.title,
      body: resolved
        ? "The team has marked this as resolved. If it isn't fixed for you, reply on the ticket and it will reopen."
        : "This ticket has been closed. Reply on the ticket any time to reopen it.",
      meta: [["Status", STATUS_LABELS[status]]],
      link: `${origin}/support/${ticket.id}`,
    }),
  );
}

const AVATAR_TTL = 10 * 60 * 1000;
const avatarCache = new Map<string, { at: number; url: string | null }>();

/** Google profile photos for the given users, keyed by user id (cached briefly). */
export async function avatarsFor(userIds: Array<string | null | undefined>) {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  const avatars: Record<string, string | null> = {};
  await Promise.all(
    ids.map(async (id) => {
      const hit = avatarCache.get(id);
      if (hit && Date.now() - hit.at < AVATAR_TTL) {
        avatars[id] = hit.url;
        return;
      }
      const { data } = await supabaseAdmin.auth.admin.getUserById(id);
      const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
      const url = meta.avatar_url ?? meta.picture;
      avatars[id] = typeof url === "string" ? url : null;
      avatarCache.set(id, { at: Date.now(), url: avatars[id] });
    }),
  );
  return avatars;
}
