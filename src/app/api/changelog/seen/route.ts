import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { createRequestSupabaseClient } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabase/server";

// Stored as a tour_progress row: completed_at holds the newest release-note
// publish time this account has seen, so it follows them across devices.
const TOUR = "whats-new";

async function sessionUserId() {
  const supabase = await createRequestSupabaseClient();
  const current = await getCurrentUserProfile(supabase);
  if (current.status === "unauthenticated" || !current.user) return null;
  return current.user.id;
}

/** GET: when this account last caught up on What's new (null if never). */
export async function GET() {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { data } = await supabaseAdmin
    .from("tour_progress")
    .select("completed_at")
    .eq("user_id", userId)
    .eq("tour", TOUR)
    .maybeSingle();
  return NextResponse.json({ seenAt: data?.completed_at ?? null });
}

/** POST { seenAt }: marks release notes up to seenAt as seen for this account. */
export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { seenAt?: unknown };
  const seenAt = typeof body.seenAt === "string" ? new Date(body.seenAt) : null;
  if (!seenAt || Number.isNaN(seenAt.getTime()))
    return NextResponse.json({ error: "seenAt must be a date" }, { status: 400 });
  const { error } = await supabaseAdmin
    .from("tour_progress")
    .upsert({ user_id: userId, tour: TOUR, completed_at: seenAt.toISOString() }, { onConflict: "user_id,tour" });
  if (error) return NextResponse.json({ error: "Couldn’t save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
