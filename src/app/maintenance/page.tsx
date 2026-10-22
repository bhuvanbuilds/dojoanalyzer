import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { createRequestSupabaseClient } from "@/lib/auth/server";
import { MAINTENANCE_UNTIL } from "@/lib/maintenance";
import { MaintenanceView } from "@/components/maintenance-view";

export const metadata: Metadata = {
  title: "Back live at 5 PM",
  description: "Dojo Belt Analyzer is under testing and opens to everyone at 5 PM.",
  robots: { index: false, follow: false },
};

export default async function MaintenancePage() {
  const supabase = await createRequestSupabaseClient();
  const currentUser = await getCurrentUserProfile(supabase);
  // People who already have access never get parked here.
  if (currentUser.status === "authenticated")
    redirect(currentUser.profile.role === "student" ? "/leaderboard" : "/");

  return (
    <MaintenanceView
      until={MAINTENANCE_UNTIL}
      email={currentUser.user?.email ?? null}
    />
  );
}
