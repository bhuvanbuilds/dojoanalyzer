import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { createRequestSupabaseClient } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * GET: whether the signed-in student has linked a LeetCode account. Cheap on
 * purpose (no sync), since the app checks it on every page for students.
 * Everyone who isn't a student counts as linked.
 */
export async function GET() {
  const supabase = await createRequestSupabaseClient();
  const current = await getCurrentUserProfile(supabase);
  if (
    current.status !== "authenticated" ||
    current.profile.role !== "student" ||
    !current.profile.student_id ||
    current.profile.viewing_as
  )
    return NextResponse.json({ linked: true });
  const { data, error } = await supabaseAdmin
    .from("leetcode_accounts")
    .select("student_id")
    .eq("student_id", current.profile.student_id)
    .maybeSingle();
  // Never lock a student out because of our own error.
  if (error) return NextResponse.json({ linked: true });
  return NextResponse.json({ linked: Boolean(data) });
}
