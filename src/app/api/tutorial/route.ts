import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { createRequestSupabaseClient } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ALL_TOUR_IDS } from "@/lib/tutorial/config";

const OUTCOMES = new Set(["completed", "skipped"]);

/** The signed-in user's id, taken from the verified session only. */
async function sessionUserId() {
  const supabase = await createRequestSupabaseClient();
  const current = await getCurrentUserProfile(supabase);
  if (current.status === "unauthenticated" || !current.user) return null;
  return current.user.id;
}

/** GET: tutorial ids this account has finished or skipped. */
export async function GET() {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from("tour_progress")
    .select("tour")
    .eq("user_id", userId)
    .in("tour", ALL_TOUR_IDS);
  if (error) return NextResponse.json({ error: "Couldn’t load tutorial progress." }, { status: 500 });
  return NextResponse.json({ completed: (data ?? []).map((row) => row.tour) });
}

/**
 * POST { tour, outcome }: records that this account finished or skipped a
 * tutorial, so it isn't shown again on any device. "Remind me later" never
 * calls this.
 */
export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { tour?: unknown; outcome?: unknown };
  if (typeof body.tour !== "string" || !ALL_TOUR_IDS.includes(body.tour))
    return NextResponse.json({ error: "Unknown tutorial" }, { status: 400 });
  const outcome = typeof body.outcome === "string" && OUTCOMES.has(body.outcome) ? body.outcome : "completed";
  const { error } = await supabaseAdmin
    .from("tour_progress")
    .upsert({ user_id: userId, tour: body.tour }, { onConflict: "user_id,tour", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "Couldn’t save tutorial progress." }, { status: 500 });
  // Lightweight measurement: which tours get finished vs skipped. No student data.
  console.info(`[tutorial] ${body.tour} ${outcome}`);
  return NextResponse.json({ ok: true });
}
