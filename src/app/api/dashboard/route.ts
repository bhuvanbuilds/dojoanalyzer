import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      },
    );

    const currentUser = await getCurrentUserProfile(supabase);

    if (currentUser.status === "unauthenticated") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (currentUser.status !== "authenticated") {
      return NextResponse.json(
        { error: "Account is not assigned to a university" },
        { status: 403 },
      );
    }

    const role = currentUser.profile.role;
    if (role !== "campus_manager" && role !== "mentor" && role !== "super_admin") {
      return NextResponse.json(
        { error: "Dashboard access is not authorized" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const requestedUniversity = searchParams.get("university_id");
    let universityIds: string[];
    if (role === "super_admin") {
      // Super admins see one campus when filtered, otherwise every campus.
      if (requestedUniversity) {
        universityIds = [requestedUniversity];
      } else {
        const { data, error } = await supabaseAdmin.from("universities").select("id");
        if (error) throw error;
        universityIds = (data ?? []).map((row) => row.id as string);
      }
    } else {
      const universityId = currentUser.profile.university_id;
      if (!universityId) {
        return NextResponse.json(
          { error: "Account is not assigned to a university" },
          { status: 403 },
        );
      }
      universityIds = [universityId];
    }

    const academicYear = Number(
      searchParams.get("academicYear") ?? "2026"
    );

    const weekNumber = Number(
      searchParams.get("weekNumber") ?? "1"
    );

    if (!Number.isInteger(academicYear) || academicYear < 2000) {
      return NextResponse.json(
        { error: "Invalid academic year" },
        { status: 400 }
      );
    }

    if (!Number.isInteger(weekNumber) || weekNumber < 1) {
      return NextResponse.json(
        { error: "Invalid week number" },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      universityIds.map(async (universityId) => {
        const [summaryResult, studentsResult] = await Promise.all([
          supabaseAdmin.rpc("get_dashboard_summary", {
            p_academic_year: academicYear,
            p_week_number: weekNumber,
            p_university_id: universityId,
          }),
          supabaseAdmin.rpc("get_dashboard_week", {
            p_academic_year: academicYear,
            p_week_number: weekNumber,
            p_university_id: universityId,
          }),
        ]);
        if (summaryResult.error) throw summaryResult.error;
        if (studentsResult.error) throw studentsResult.error;
        return { summary: summaryResult.data?.[0] ?? null, students: studentsResult.data ?? [] };
      }),
    );

    return NextResponse.json({
      academicYear,
      weekNumber,
      // A single campus keeps its summary; combined campuses have none.
      summary: results.length === 1 ? results[0].summary : null,
      students: results.flatMap((result) => result.students),
    });
  } catch (error) {
    console.error("Dashboard error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}