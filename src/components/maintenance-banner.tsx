"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";

type Maintenance = { enabled: boolean; until: string | null };

/**
 * Thin amber bar for the developers and super admins who can still use the
 * app during maintenance, so nobody forgets it is switched on.
 */
export function MaintenanceBanner() {
  const [maintenance, setMaintenance] = useState<Maintenance | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch("/api/maintenance", { cache: "no-store" })
        .then((response) => response.json())
        .then((result: { maintenance?: Maintenance }) => {
          if (active) setMaintenance(result.maintenance ?? null);
        })
        .catch(() => undefined);
    load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  if (!maintenance?.enabled) return null;
  return (
    <div className="relative z-40 flex items-center justify-center gap-2 bg-[#f59e0b] px-4 py-1.5 text-center text-[12.5px] font-semibold text-[#3b2300]">
      <Wrench size={13} />
      Maintenance is on — only developers and super admins can use the app
      {maintenance.until
        ? ` until ${new Date(maintenance.until).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
        : ""}
      .
      <Link href="/settings/maintenance" className="underline underline-offset-2">
        Manage
      </Link>
    </div>
  );
}
