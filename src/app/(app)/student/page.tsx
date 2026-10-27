"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getCurrentUserProfile,
  type CurrentUserProfile,
} from "@/lib/auth/profile";
import { useCachedProfile } from "@/lib/auth/use-cached-profile";
import { PageState } from "@/components/ui/skeleton";
import { StudentOverviewPage } from "@/components/students/student-overview";

/** A student's own Dojo profile. Staff have no student record, so go home. */
export default function MyStudentProfilePage() {
  const router = useRouter();
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

  useEffect(() => {
    if (profileState.status === "unauthenticated") router.replace("/login");
    if (
      profileState.status === "authenticated" &&
      profileState.profile.role !== "student"
    )
      router.replace("/");
  }, [profileState, router]);

  if (profileState.status === "loading")
    return <PageState message="Checking your account..." loading />;
  if (profileState.status === "error")
    return (
      <PageState
        message="Unable to load your account"
        detail={profileState.message}
      />
    );
  if (
    profileState.status !== "authenticated" ||
    profileState.profile.role !== "student"
  )
    return <PageState message="Redirecting..." loading />;

  return <StudentOverviewPage studentId={profileState.profile.student_id} />;
}
