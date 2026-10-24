import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { createRequestSupabaseClient } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabase/server";

/** POST: heartbeat from an open tab; marks the signed-in person as active now. */
export async function POST() {
  const supabase = await createRequestSupabaseClient();
  const current = await getCurrentUserProfile(supabase);
  if (current.status !== "authenticated" || !current.user)
    return NextResponse.json({ ok: false }, { status: 401 });
  // While previewing another role, don't count as their activity.
  if (current.profile.viewing_as) return NextResponse.json({ ok: true });
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", current.user.id);
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}
