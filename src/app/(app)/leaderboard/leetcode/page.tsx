"use client";

import { Suspense } from "react";
import { LeetCodeLeaderboard } from "@/components/leetcode/leetcode-leaderboard";
import { PageState } from "@/components/ui/skeleton";

export default function LeetCodeLeaderboardPage() {
  return (
    <Suspense fallback={<PageState message="Loading leaderboard…" loading />}>
      <LeetCodeLeaderboard />
    </Suspense>
  );
}
