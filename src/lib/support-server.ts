import "server-only";
import { isUuid } from "@/lib/is-uuid";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Loads a ticket the caller may see: their own, or any for super admins. */
export async function loadVisibleTicket(ticketId: string, userId: string, isStaff: boolean) {
  if (!isUuid(ticketId)) return null;
  const { data, error } = await supabaseAdmin
    .from("support_tickets")
    .select(
      "id, number, user_id, type, title, description, severity, status, page_url, user_agent, reporter_email, reporter_name, reporter_role, created_at, updated_at",
    )
    .eq("id", ticketId)
    .maybeSingle();
  if (error) throw error;
  if (!data || (!isStaff && data.user_id !== userId)) return null;
  return data;
}
