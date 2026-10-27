"use client";

import { Suspense } from "react";
import { LeaderboardBoard } from "@/components/leaderboard/board";
import { PageState } from "@/components/ui/skeleton";

export default function OverallLeaderboardPage() {
  return (
    <Suspense fallback={<PageState message="Loading leaderboard…" loading />}>
      <LeaderboardBoard kind="overall" />
    </Suspense>
  );
}
