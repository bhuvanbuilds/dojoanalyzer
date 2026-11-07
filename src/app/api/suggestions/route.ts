import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { createRequestSupabaseClient } from "@/lib/auth/server";
import { loadSuggestions } from "@/lib/suggestions-server";

/**
 * GET ?language=java&belt=5: the signed-in student's practice plan (belt defaults to their next one). The next belt's
 * topics come weakest first, with problems they've already solved marked so
 * the page can leave them out.
 */
export async function GET(request: Request) {
  const supabase = await createRequestSupabaseClient();
  const current = await getCurrentUserProfile(supabase);
  if (current.status !== "authenticated" || current.profile.role !== "student" || !current.profile.student_id)
    return NextResponse.json({ error: "Students only" }, { status: 403 });
  try {
    const params = new URL(request.url).searchParams;
    const plan = await loadSuggestions(current.profile, params.get("language"), Number(params.get("belt")) || null);
    const { solved, ...rest } = plan;
    return NextResponse.json({ ...rest, solvedCount: solved.length });
  } catch (error) {
    console.error("Suggestions error:", error);
    return NextResponse.json({ error: "Couldn’t build your suggestions. Please try again." }, { status: 500 });
  }
}
