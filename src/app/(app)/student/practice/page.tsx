"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUserProfile, type CurrentUserProfile } from "@/lib/auth/profile";
import { useCachedProfile } from "@/lib/auth/use-cached-profile";
import { PageState } from "@/components/ui/skeleton";
import { PracticePage } from "@/components/practice/practice-page";

/** Students only: problem suggestions for their next belt. */
export default function StudentPracticePage() {
  const router = useRouter();
  const cached = useCachedProfile();
  const [state, setState] = useState<CurrentUserProfile | { status: "loading" }>(cached ?? { status: "loading" });
  useEffect(() => {
    let mounted = true;
    getCurrentUserProfile().then((result) => mounted && setState(result));
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (state.status === "unauthenticated") router.replace("/login");
    if (state.status === "authenticated" && state.profile.role !== "student") router.replace("/");
  }, [state, router]);

  if (state.status === "loading") return <PageState message="Checking your account…" loading />;
  if (state.status !== "authenticated" || state.profile.role !== "student") return <PageState message="Redirecting…" loading />;
  return <PracticePage />;
}
