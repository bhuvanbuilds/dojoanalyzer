import { NextResponse } from "next/server";
import { requireDeveloper, requireRoles, writeAuditLog } from "@/lib/auth/authorization";
import { isUuid } from "@/lib/is-uuid";
import { supabaseAdmin } from "@/lib/supabase/server";
import { noticeEmail, sendEmail } from "@/lib/email";
import { loadTargetStudents } from "@/lib/belt-targets-server";
import {
  cleanLanguageGains,
  describeTarget,
  monthKey,
  monthLabel,
  parseMonth,
  totalBelts,
} from "@/lib/belt-targets";

const STAFF = ["mentor", "campus_manager", "super_admin"] as const;
const FAILED = () =>
  NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });

/** The table may not exist yet if its migration hasn't been run. */
const missingTable = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: string }).code === "42P01";

function origin(request: Request) {
  return process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
}

/** GET ?month=2026-11&university_id=…: students in scope with their target and progress. */
export async function GET(request: Request) {
  const authorization = await requireRoles(STAFF);
  if (authorization.response) return authorization.response;
  try {
    const params = new URL(request.url).searchParams;
    const month = parseMonth(params.get("month")) ?? monthKey();
    const universityId = params.get("university_id");
    const students = await loadTargetStudents(authorization.profile, month, {
      universityId: isUuid(universityId) ? universityId : null,
    });
    // Developers see how many test targets exist (any month), to clear them.
    const profile = authorization.profile;
    let testCount: number | undefined;
    if (profile.is_developer && !profile.viewing_as) {
      const { count, error } = await supabaseAdmin
        .from("belt_targets")
        .select("id", { count: "exact", head: true })
        .eq("is_test", true);
      if (error) throw error;
      testCount = count ?? 0;
    }
    // Emails stay on the server; the page only needs names and belts.
    return NextResponse.json({
      month,
      testCount,
      students: students.map((student) => ({ ...student, email: undefined })),
    });
  } catch (error) {
    if (missingTable(error))
      return NextResponse.json({ error: "Belt targets aren't set up in the database yet." }, { status: 503 });
    console.error("Targets GET error:", error);
    return FAILED();
  }
}

/**
 * POST { studentIds, month, totalGain | languageGains, note?, notify?, test? }:
 * sets (or replaces) the month's target for each student, then emails each
 * of them their own message. `test` (developers only) saves test targets:
 * no email, hidden from the student, and never replacing a real target.
 */
export async function POST(request: Request) {
  const authorization = await requireRoles(STAFF);
  if (authorization.response) return authorization.response;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const month = parseMonth(body.month);
    const studentIds = Array.isArray(body.studentIds) ? [...new Set(body.studentIds.filter(isUuid))] : [];
    const totalGain = Number(body.totalGain);
    const languageGains = cleanLanguageGains(body.languageGains);
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) || null : null;
    const isTest = body.test === true;
    if (isTest && (!authorization.profile.is_developer || authorization.profile.viewing_as))
      return NextResponse.json({ error: "Only developers can set test targets" }, { status: 403 });
    if (!month || month < monthKey()) return NextResponse.json({ error: "Pick this month or a later one" }, { status: 400 });
    if (!studentIds.length || studentIds.length > 500)
      return NextResponse.json({ error: "Select between 1 and 500 students" }, { status: 400 });
    const byTotal = !languageGains;
    if (byTotal && !(Number.isInteger(totalGain) && totalGain >= 1 && totalGain <= 40))
      return NextResponse.json({ error: "Set a target of 1 to 40 belts, or a number per language" }, { status: 400 });

    // Only students this person is allowed to manage.
    const students = await loadTargetStudents(authorization.profile, month, { studentIds });
    if (students.length !== studentIds.length)
      return NextResponse.json({ error: "Some of these students aren't in your squads or campus" }, { status: 403 });
    if (isTest) {
      const real = students.filter((student) => student.target && !student.target.is_test).length;
      if (real)
        return NextResponse.json(
          {
            error: `${real} of these student${real === 1 ? " has" : "s have"} a real target this month. Test targets never replace real ones, so unselect them first.`,
          },
          { status: 409 },
        );
    }

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("belt_targets").upsert(
      students.map((student) => ({
        student_id: student.id,
        month,
        total_gain: byTotal ? totalGain : null,
        language_gains: byTotal ? null : languageGains,
        note,
        set_by: authorization.user.id,
        seen_at: null,
        is_test: isTest,
        updated_at: now,
      })),
      { onConflict: "student_id,month" },
    );
    if (error) throw error;

    const target = { total_gain: byTotal ? totalGain : null, language_gains: byTotal ? null : languageGains };
    const summary = describeTarget(target);
    await writeAuditLog(authorization.user.id, "belt_targets_set", "student", null, {
      month,
      students: students.length,
      target: summary,
      test: isTest,
    });

    const emailedIds: string[] = [];
    let emailFailed = 0;
    if (body.notify !== false && !isTest) {
      const setter = authorization.profile.full_name ?? "Your mentor";
      const link = `${origin(request)}/student`;
      // One email per student, so nobody sees anyone else's address.
      for (const student of students) {
        if (!student.email) continue;
        const sent = await sendEmail(
          [student.email],
          `Your belt target for ${monthLabel(month)}: ${summary}`,
          noticeEmail({
            eyebrow: "Belt target",
            heading: `Your target for ${monthLabel(month)}`,
            body: `Hi ${student.name},\n\n${setter} has set your Dojo belt target: ${summary.toLowerCase()} this month.${
              note ? `\n\n“${note}”` : ""
            }\n\nYou hold ${totalBelts(student.now)} belts right now. Your progress updates after every weekly belt test.`,
            meta: [
              ["Target", summary],
              ["Month", monthLabel(month)],
              ["Squad", `Squad ${student.squad_number}`],
            ],
            link,
            cta: "See my progress",
          }),
        );
        if (sent) emailedIds.push(student.id);
        else emailFailed += 1;
      }
      // Only the students whose email actually went out.
      if (emailedIds.length)
        await supabaseAdmin
          .from("belt_targets")
          .update({ emailed_at: new Date().toISOString() })
          .in("student_id", emailedIds)
          .eq("month", month);
    }
    return NextResponse.json({ saved: students.length, emailed: emailedIds.length, emailFailed });
  } catch (error) {
    if (missingTable(error))
      return NextResponse.json({ error: "Belt targets aren't set up in the database yet." }, { status: 503 });
    console.error("Targets POST error:", error);
    return FAILED();
  }
}

/**
 * DELETE { studentIds, month }: removes those students' targets for the month.
 * DELETE { allTests: true }: developers only; removes every test target (any
 * month, any campus) and nothing else.
 */
export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.allTests === true) return deleteTestTargets();
  const authorization = await requireRoles(STAFF);
  if (authorization.response) return authorization.response;
  try {
    const month = parseMonth(body.month);
    const studentIds = Array.isArray(body.studentIds) ? [...new Set(body.studentIds.filter(isUuid))] : [];
    if (!month || !studentIds.length) return NextResponse.json({ error: "Nothing to remove" }, { status: 400 });
    const students = await loadTargetStudents(authorization.profile, month, { studentIds });
    if (students.length !== studentIds.length)
      return NextResponse.json({ error: "Some of these students aren't in your squads or campus" }, { status: 403 });
    const { error } = await supabaseAdmin.from("belt_targets").delete().in("student_id", studentIds).eq("month", month);
    if (error) throw error;
    await writeAuditLog(authorization.user.id, "belt_targets_removed", "student", null, { month, students: studentIds.length });
    return NextResponse.json({ removed: studentIds.length });
  } catch (error) {
    console.error("Targets DELETE error:", error);
    return FAILED();
  }
}

async function deleteTestTargets() {
  const authorization = await requireDeveloper();
  if (authorization.response) return authorization.response;
  try {
    const { data, error } = await supabaseAdmin.from("belt_targets").delete().eq("is_test", true).select("id");
    if (error) throw error;
    const removed = data?.length ?? 0;
    await writeAuditLog(authorization.user.id, "belt_targets_tests_cleared", "student", null, { removed });
    return NextResponse.json({ removed });
  } catch (error) {
    if (missingTable(error)) return NextResponse.json({ removed: 0 });
    console.error("Targets test cleanup error:", error);
    return FAILED();
  }
}
