"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUserProfile, type CurrentUserProfile } from "@/lib/auth/profile";
import { useCachedProfile } from "@/lib/auth/use-cached-profile";
import { Frame, Page } from "@/components/ui/frame";
import { ProfileTabs } from "@/components/students/profile-tabs";
import { LeetCodeProfile } from "@/components/leetcode/leetcode-profile";

/** Any student's LeetCode profile. Everyone signed in can see it, like on LeetCode. */
export default function StudentLeetCodePage() {
  const { studentId } = useParams<{ studentId: string }>();
  const cached = useCachedProfile();
  const [account, setAccount] = useState<CurrentUserProfile | null>(cached);
  useEffect(() => {
    let active = true;
    getCurrentUserProfile()
      .then((result) => active && setAccount(result))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  const staff = account?.status === "authenticated" && account.profile.role !== "student";

  return (
    <Page>
      <Frame>
        <div className="flex items-center justify-between gap-3 bg-surface-2 px-3 py-2 sm:px-4">
          <Link
            href="/leaderboard/leetcode"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-ink-2 transition hover:bg-ink/5 hover:text-ink"
          >
            <ArrowLeft size={15} /> LeetCode leaderboard
          </Link>
        </div>
        <ProfileTabs studentId={studentId} active="leetcode" staff={staff} />
        <LeetCodeProfile studentId={studentId} />
      </Frame>
    </Page>
  );
}
