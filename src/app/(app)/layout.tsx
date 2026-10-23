import type { ReactNode } from "react";
import { Navbar } from "@/components/navbar";
import { SupportLauncher } from "@/components/support/support-launcher";
import { MaintenanceBanner } from "@/components/maintenance-banner";
import { ViewAsBanner } from "@/components/view-as-banner";

/**
 * Layout for all authenticated campus/mentor management pages.
 *
 * Route group (app) does NOT change URL paths — /imports stays /imports etc.
 *
 * This layout renders the shared flat app bar above every page; each page
 * then lays itself out as one full-width Frame (components/ui/frame).
 * It is intentionally NOT applied to:
 *  - /login
 *  - /student
 *  - /auth/callback
 *  - API routes
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dot-matrix relative min-h-screen">
      <ViewAsBanner />
      <MaintenanceBanner />
      <Navbar />
      <div className="relative z-10">{children}</div>
      <SupportLauncher />
    </div>
  );
}
