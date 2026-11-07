import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { createRequestSupabaseClient } from "@/lib/auth/server";
import { loadCards, loadScopedStudents, saveUsername, syncStale } from "@/lib/leetcode-server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { cleanUsername } from "@/lib/leetcode";

/** The student's latest new solves, newest first. */
async function recentSolves(studentId: string) {
  const { data } = await supabaseAdmin
    .from("leetcode_solves")
    .select("title_slug, title, solved_at")
    .eq("student_id", studentId)
    .eq("counted", true)
    .order("solved_at", { ascending: false })
    .limit(12);
  return data ?? [];
}

async function student() {
  const supabase = await createRequestSupabaseClient();
  const current = await getCurrentUserProfile(supabase);
  if (current.status !== "authenticated" || current.profile.role !== "student" || !current.profile.student_id) return null;
  return { profile: current.profile, userId: current.user.id };
}

async function myCard(profile: NonNullable<Awaited<ReturnType<typeof student>>>["profile"]) {
  // A student's own record, without any squad limit.
  const [me] = await loadScopedStudents({ ...profile, role: "super_admin", squad_ids: null }, { studentIds: [profile.student_id!] });
  if (!me) return null;
  const [card] = await loadCards([me]);
  return card ?? null;
}

/** GET: the signed-in student's LeetCode card, refreshed if older than 5 minutes. */
export async function GET() {
  const me = await student();
  if (!me) return NextResponse.json({ error: "Students only" }, { status: 403 });
  try {
    await syncStale([me.profile.student_id!], 5);
    return NextResponse.json({ card: await myCard(me.profile), recent: await recentSolves(me.profile.student_id!) });
  } catch (error) {
    console.error("LeetCode me GET error:", error);
    return NextResponse.json({ card: null, error: "Couldn’t load your LeetCode data" }, { status: 500 });
  }
}

/** PUT { username }: link (or unlink, with an empty username) the student's own LeetCode account. */
export async function PUT(request: Request) {
  const me = await student();
  if (!me) return NextResponse.json({ error: "Students only" }, { status: 403 });
  if (me.profile.viewing_as) return NextResponse.json({ error: "View as is read-only" }, { status: 403 });
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const raw = typeof body.username === "string" ? body.username.trim() : "";
    const username = raw ? cleanUsername(raw) : null;
    if (raw && !username) return NextResponse.json({ error: "That doesn’t look like a LeetCode username" }, { status: 400 });
    const problem = await saveUsername(me.profile.student_id!, username, me.userId);
    if (problem) return NextResponse.json({ error: problem }, { status: 409 });
    return NextResponse.json({ card: await myCard(me.profile), recent: await recentSolves(me.profile.student_id!) });
  } catch (error) {
    console.error("LeetCode me PUT error:", error);
    return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
  }
}
