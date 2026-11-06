import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { createRequestSupabaseClient } from "@/lib/auth/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { loadTargetStudents } from "@/lib/belt-targets-server";
import { monthKey, targetProgress } from "@/lib/belt-targets";

async function student() {
  const supabase = await createRequestSupabaseClient();
  const current = await getCurrentUserProfile(supabase);
  if (current.status !== "authenticated" || current.profile.role !== "student" || !current.profile.student_id)
    return null;
  return current.profile;
}

/** GET: the signed-in student's target for this month, with progress. */
export async function GET() {
  const profile = await student();
  if (!profile) return NextResponse.json({ target: null });
  try {
    const month = monthKey();
    // A student's own record, without any squad limit.
    const [me] = await loadTargetStudents({ ...profile, role: "super_admin", squad_ids: null }, month, {
      studentIds: [profile.student_id!],
    });
    if (!me) return NextResponse.json({ target: null });
    // Test targets are for developers: only visible through "View as".
    const target = me.target && (!me.target.is_test || profile.viewing_as) ? me.target : null;
    return NextResponse.json({
      target,
      progress: target ? targetProgress(target, me.start, me.now) : undefined,
      month,
      // Belts held now and at the month's start, for the quest page.
      now: me.now,
      start: me.start,
    });
  } catch {
    // No table yet, or a hiccup: the profile simply shows no target.
    return NextResponse.json({ target: null });
  }
}

/** POST: marks this month's target as seen, so the popup shows only once. */
export async function POST() {
  const profile = await student();
  if (!profile) return NextResponse.json({ ok: false }, { status: 403 });
  // View as is read-only and never marks anything as seen.
  if (profile.viewing_as) return NextResponse.json({ ok: true });
  const { error } = await supabaseAdmin
    .from("belt_targets")
    .update({ seen_at: new Date().toISOString() })
    .eq("student_id", profile.student_id!)
    .eq("month", monthKey())
    .eq("is_test", false)
    .is("seen_at", null);
  return NextResponse.json({ ok: !error });
}
