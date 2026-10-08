"use client";

import { Suspense } from "react";
import { LeaderboardBoard } from "@/components/leaderboard/board";
import { PageState } from "@/components/ui/skeleton";

export default function LanguageLeaderboardPage() {
  return (
    <Suspense fallback={<PageState message="Loading leaderboard…" loading />}>
      <LeaderboardBoard kind="language" />
    </Suspense>
  );
}
