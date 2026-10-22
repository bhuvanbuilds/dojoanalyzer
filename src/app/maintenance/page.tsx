import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { createRequestSupabaseClient } from "@/lib/auth/server";
import { getMaintenance } from "@/lib/maintenance";
import { MaintenanceView } from "@/components/maintenance-view";

export const metadata: Metadata = {
  title: "Under maintenance",
  description: "Dojo Belt Analyzer is under maintenance and will be back soon.",
  robots: { index: false, follow: false },
};

export default async function MaintenancePage() {
  const maintenance = await getMaintenance({ fresh: true });
  // Nothing to wait for: send people back into the app.
  if (!maintenance.enabled) redirect("/");

  const supabase = await createRequestSupabaseClient();
  const currentUser = await getCurrentUserProfile(supabase);
  return (
    <MaintenanceView
      until={maintenance.until}
      message={maintenance.message}
      email={currentUser.user?.email ?? null}
    />
  );
}
