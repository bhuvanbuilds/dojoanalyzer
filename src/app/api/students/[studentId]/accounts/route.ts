import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { createRequestSupabaseClient } from "@/lib/auth/server";
import { writeAuditLog } from "@/lib/auth/authorization";
import { isUuid } from "@/lib/is-uuid";
import { supabaseAdmin } from "@/lib/supabase/server";
import { loadScopedStudents, saveUsername } from "@/lib/leetcode-server";
import { cleanUsername } from "@/lib/leetcode";

const LANGUAGES = ["cpp", "java", "nodejs", "python"] as const;
const STAFF = ["mentor", "campus_manager", "super_admin"];
type Context = { params: Promise<{ studentId: string }> };

async function viewer() {
  const supabase = await createRequestSupabaseClient();
  const current = await getCurrentUserProfile(supabase);
  return current.status === "authenticated" ? current : null;
}

async function load(studentId: string, staff: boolean) {
  const [student, links, leetcode] = await Promise.all([
    supabaseAdmin.from("students").select("primary_language, secondary_language, personal_email").eq("id", studentId).maybeSingle(),
    supabaseAdmin.from("student_links").select("github_url, linkedin_url, codechef_url").eq("student_id", studentId).maybeSingle(),
    supabaseAdmin.from("leetcode_accounts").select("username").eq("student_id", studentId).maybeSingle(),
  ]);
  if (!student.data) return null;
  return {
    primary_language: student.data.primary_language ?? null,
    secondary_language: student.data.secondary_language ?? null,
    // Personal emails are for staff only.
    personal_email: staff ? (student.data.personal_email ?? null) : undefined,
    leetcode: leetcode.data?.username ?? null,
    github: links.data?.github_url ?? null,
    linkedin: links.data?.linkedin_url ?? null,
    codechef: links.data?.codechef_url ?? null,
  };
}

/** GET: a student's languages and linked accounts. `canEdit` says whether this viewer may change them. */
export async function GET(_request: Request, context: Context) {
  const current = await viewer();
  if (!current) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { studentId } = await context.params;
  if (!isUuid(studentId)) return NextResponse.json({ error: "Student not found" }, { status: 404 });
  const staff = STAFF.includes(current.profile.role) && !current.profile.viewing_as;
  const inScope = staff && (await loadScopedStudents(current.profile, { studentIds: [studentId] })).length > 0;
  const data = await load(studentId, staff);
  if (!data) return NextResponse.json({ error: "Student not found" }, { status: 404 });
  return NextResponse.json({ ...data, canEdit: inScope });
}

const cleanUrl = (raw: unknown, host: RegExp) => {
  if (typeof raw !== "string" || !raw.trim()) return null;
  let value = raw.trim();
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const url = new URL(value);
    if (!host.test(url.hostname)) return undefined;
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
};

/** PUT: staff in scope set languages, personal email and linked accounts. Empty clears a field. */
export async function PUT(request: Request, context: Context) {
  const current = await viewer();
  if (!current) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!STAFF.includes(current.profile.role) || current.profile.viewing_as)
    return NextResponse.json({ error: "Only mentors, campus managers and admins can edit this" }, { status: 403 });
  const { studentId } = await context.params;
  if (!isUuid(studentId) || !(await loadScopedStudents(current.profile, { studentIds: [studentId] })).length)
    return NextResponse.json({ error: "This student isn’t in your squads or campus" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const lang = (value: unknown) => (LANGUAGES.includes(value as (typeof LANGUAGES)[number]) ? (value as string) : null);
  const primary = lang(body.primary_language);
  const secondary = lang(body.secondary_language);
  if (primary && secondary === primary) return NextResponse.json({ error: "Primary and secondary must be different languages" }, { status: 400 });
  const email = typeof body.personal_email === "string" ? body.personal_email.trim().toLowerCase() : "";
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "That personal email doesn’t look right" }, { status: 400 });
  const github = cleanUrl(body.github, /(^|\.)github\.com$/i);
  const linkedin = cleanUrl(body.linkedin, /(^|\.)linkedin\.com$/i);
  const codechef = cleanUrl(body.codechef, /(^|\.)codechef\.com$/i);
  if (github === undefined || linkedin === undefined || codechef === undefined)
    return NextResponse.json({ error: "Links must be github.com, linkedin.com and codechef.com profile links" }, { status: 400 });
  const rawLeet = typeof body.leetcode === "string" ? body.leetcode.trim() : "";
  const leetcode = rawLeet ? cleanUsername(rawLeet) : null;
  if (rawLeet && !leetcode) return NextResponse.json({ error: "That doesn’t look like a LeetCode username" }, { status: 400 });

  try {
    const studentUpdate = await supabaseAdmin
      .from("students")
      .update({ primary_language: primary, secondary_language: secondary, personal_email: email || null })
      .eq("id", studentId);
    if (studentUpdate.error) throw studentUpdate.error;
    const linkUpdate = await supabaseAdmin
      .from("student_links")
      .upsert({ student_id: studentId, github_url: github, linkedin_url: linkedin, codechef_url: codechef, updated_at: new Date().toISOString() }, { onConflict: "student_id" });
    if (linkUpdate.error) throw linkUpdate.error;
    const existing = await supabaseAdmin.from("leetcode_accounts").select("username").eq("student_id", studentId).maybeSingle();
    if ((existing.data?.username ?? null)?.toLowerCase() !== leetcode?.toLowerCase()) {
      const problem = await saveUsername(studentId, leetcode, current.user.id);
      if (problem) return NextResponse.json({ error: problem }, { status: 409 });
    }
    await writeAuditLog(current.user.id, "student_accounts_updated", "student", studentId, { primary, secondary, leetcode, github, linkedin, codechef });
    return NextResponse.json({ ...(await load(studentId, true)), canEdit: true });
  } catch (error) {
    console.error("Student accounts PUT error:", error);
    return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
  }
}
