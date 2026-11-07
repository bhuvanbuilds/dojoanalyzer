import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { createRequestSupabaseClient } from "@/lib/auth/server";
import { achievementsFor } from "@/lib/gamification-server";

/** GET: the signed-in student's achievements with progress. */
export async function GET() {
  const supabase = await createRequestSupabaseClient();
  const current = await getCurrentUserProfile(supabase);
  if (current.status !== "authenticated" || current.profile.role !== "student" || !current.profile.student_id)
    return NextResponse.json({ error: "Students only" }, { status: 403 });
  try {
    return NextResponse.json({ achievements: await achievementsFor(current.profile.student_id) });
  } catch (error) {
    console.error("Achievements error:", error);
    return NextResponse.json({ error: "Couldn’t load achievements." }, { status: 500 });
  }
}
