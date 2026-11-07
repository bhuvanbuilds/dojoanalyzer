import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { createRequestSupabaseClient } from "@/lib/auth/server";
import { getDailyChallenge } from "@/lib/daily-challenge-server";

/**
 * GET: the signed-in student's daily challenge, streak and last 14 days.
 * Completion is automatic from LeetCode; there is no way to tick it by hand.
 */
export async function GET() {
  const supabase = await createRequestSupabaseClient();
  const current = await getCurrentUserProfile(supabase);
  if (current.status !== "authenticated" || current.profile.role !== "student" || !current.profile.student_id)
    return NextResponse.json({ error: "Students only" }, { status: 403 });
  try {
    return NextResponse.json(await getDailyChallenge(current.profile));
  } catch (error) {
    console.error("Daily challenge error:", error);
    return NextResponse.json({ error: "Couldn’t load today’s challenge." }, { status: 500 });
  }
}
