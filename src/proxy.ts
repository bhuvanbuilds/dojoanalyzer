import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { getMaintenance } from "@/lib/maintenance";
import { VIEW_AS_COOKIE } from "@/lib/view-as";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const currentUser = await getCurrentUserProfile(
    Object.assign(supabase, {
      viewAsCookie: request.cookies.get(VIEW_AS_COOKIE)?.value ?? null,
    }),
  );
  const pathname = request.nextUrl.pathname;

  // "View as" is look-only: a developer viewing as someone else can't change
  // anything until they exit (exiting itself is the one allowed write).
  if (
    currentUser.status === "authenticated" &&
    currentUser.profile.viewing_as &&
    pathname.startsWith("/api/") &&
    pathname !== "/api/developer/view-as" &&
    request.method !== "GET" &&
    request.method !== "HEAD"
  ) {
    return NextResponse.json(
      { error: "You're viewing as another role, which is read-only. Exit View as to make changes." },
      { status: 403 },
    );
  }

  // Maintenance: only developers (who hold the switch) stay in. Everyone
  // else gets the maintenance page, and their API calls a 503.
  const maintenanceExempt = pathname === "/maintenance" || pathname === "/api/maintenance";
  if (!maintenanceExempt) {
    const maintenance = await getMaintenance();
    // Only developers stay in during maintenance.
    const insider = currentUser.status === "authenticated" && currentUser.profile.is_developer;
    if (maintenance.enabled && !insider) {
      if (pathname.startsWith("/api/"))
        return NextResponse.json(
          { error: "Dojo Belt Analyzer is under maintenance. Please try again soon." },
          { status: 503, headers: { "Retry-After": "300" } },
        );
      const redirectResponse = NextResponse.redirect(new URL("/maintenance", request.url));
      response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
      return redirectResponse;
    }
  }
  if (pathname.startsWith("/api/") || pathname === "/maintenance") return response;

  // Signed in without an account: the only page for them is the request form.
  const noAccount = currentUser.status === "unassigned" || currentUser.status === "invalid_role";
  if (noAccount && pathname !== "/request-access") {
    const redirectResponse = NextResponse.redirect(new URL("/request-access", request.url));
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }
  if (pathname === "/request-access") return response;
  if (
    currentUser.status === "authenticated" &&
    currentUser.profile.role === "student"
  ) {
    // Students get the leaderboards, their profile and student overviews.
    const studentAllowed =
      pathname === "/leaderboard" ||
      pathname.startsWith("/leaderboard/") ||
      pathname === "/profile" ||
      pathname === "/student" ||
      pathname.startsWith("/student/") ||
      pathname === "/changelog" ||
      (pathname === "/support" || pathname.startsWith("/support/")) &&
        !pathname.startsWith("/support/inbox");
    if (!studentAllowed) {
      const redirectResponse = NextResponse.redirect(
        new URL("/leaderboard", request.url),
      );
      response.cookies
        .getAll()
        .forEach((cookie) => redirectResponse.cookies.set(cookie));
      return redirectResponse;
    }
  }
  if (currentUser.status === "authenticated") {
    const role = currentUser.profile.role;
    const superAdminOnly =
      pathname === "/users" ||
      pathname.startsWith("/users/") ||
      pathname === "/universities" ||
      pathname.startsWith("/universities/") ||
      pathname === "/audit-logs" ||
      pathname.startsWith("/audit-logs/") ||
      pathname.startsWith("/settings") ||
      pathname === "/developer" ||
      pathname.startsWith("/developer/") ||
      pathname.startsWith("/support/inbox");
    const managerOnly =
      pathname === "/imports" || pathname.startsWith("/imports/");
    // Developer tools: maintenance settings and the developer console.
    const developerOnly =
      pathname.startsWith("/settings") ||
      pathname === "/developer" ||
      pathname.startsWith("/developer/");
    if (
      (developerOnly && (!currentUser.profile.is_developer || currentUser.profile.viewing_as)) ||
      (superAdminOnly && role !== "super_admin") ||
      (managerOnly && role !== "super_admin" && role !== "campus_manager")
    ) {
      const destination = role === "student" ? "/leaderboard" : "/";
      const redirectResponse = NextResponse.redirect(
        new URL(destination, request.url),
      );
      response.cookies
        .getAll()
        .forEach((cookie) => redirectResponse.cookies.set(cookie));
      return redirectResponse;
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/dashboard",
    "/dashboard/:path*",
    "/students",
    "/students/:path*",
    "/imports",
    "/imports/:path*",
    "/weekly-comparison",
    "/weekly-comparison/:path*",
    "/leaderboard/language",
    "/leaderboard/language/:path*",
    "/leaderboard",
    "/leaderboard/:path*",
    "/analytics",
    "/analytics/:path*",
    "/universities",
    "/universities/:path*",
    "/users",
    "/users/:path*",
    "/audit-logs",
    "/audit-logs/:path*",
    "/profile",
    "/student",
    "/student/:path*",
    "/support",
    "/support/:path*",
    "/settings/:path*",
    "/developer",
    "/developer/:path*",
    "/changelog",
    "/maintenance",
    "/request-access",
    "/api/:path*",
  ],
};
