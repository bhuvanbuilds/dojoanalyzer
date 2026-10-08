"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getCurrentUserProfile,
  type CurrentUserProfile,
} from "@/lib/auth/profile";
import { useCachedProfile } from "@/lib/auth/use-cached-profile";
import { PageState } from "@/components/ui/skeleton";
import { StudentOverviewPage } from "@/components/students/student-overview";

/**
 * Any student's public overview. Staff get the full profile instead, so
 * they're sent to the student history page.
 */
export default function StudentOverviewRoute() {
  const router = useRouter();
  const { studentId } = useParams<{ studentId: string }>();
  const cachedProfile = useCachedProfile();
  const [profileState, setProfileState] = useState<
    CurrentUserProfile | { status: "loading" }
  >(cachedProfile ?? { status: "loading" });

  useEffect(() => {
    let mounted = true;
    getCurrentUserProfile().then((result) => {
      if (mounted) setProfileState(result);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const isStaff =
    profileState.status === "authenticated" &&
    profileState.profile.role !== "student";
  useEffect(() => {
    if (profileState.status === "unauthenticated") router.replace("/login");
    if (isStaff) router.replace(`/students/${studentId}/history`);
  }, [profileState, isStaff, router, studentId]);

  if (profileState.status === "loading")
    return <PageState message="Checking your account..." loading />;
  if (profileState.status === "error")
    return (
      <PageState
        message="Unable to load your account"
        detail={profileState.message}
      />
    );
  if (profileState.status !== "authenticated" || isStaff)
    return <PageState message="Redirecting..." loading />;

  return <StudentOverviewPage studentId={studentId} />;
}
