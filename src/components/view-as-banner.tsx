"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearProfileCache } from "@/lib/auth/profile";
import { Compass, Eye, LogOut } from "lucide-react";
import { tutorialRoleFor } from "@/lib/tutorial/config";
import { startTutorial } from "@/components/tutorial/tutorial";
import type { ViewAs } from "@/lib/view-as";

/** Violet bar while a developer views the app as someone else. */
export function ViewAsBanner() {
  const router = useRouter();
  const [viewAs, setViewAs] = useState<ViewAs | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/developer/view-as", { cache: "no-store" })
      .then((response) => response.json())
      .then((result: { viewAs?: ViewAs | null }) => {
        if (active) setViewAs(result.viewAs ?? null);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function exit() {
    setLeaving(true);
    await fetch("/api/developer/view-as", { method: "DELETE" }).catch(() => undefined);
    // Forget the viewed profile so every page loads again as yourself.
    clearProfileCache();
    setViewAs(null);
    setLeaving(false);
    router.push("/developer");
    router.refresh();
  }

  if (!viewAs) return null;
  return (
    <div className="relative z-40 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[#6d28d9] px-4 py-1.5 text-center text-[12.5px] font-semibold text-white">
      <span className="inline-flex items-center gap-1.5">
        <Eye size={13} /> Viewing as {viewAs.label}
      </span>
      <span className="font-normal text-white/75">Read-only — changes are blocked</span>
      {tutorialRoleFor({ role: viewAs.role, viewing_as: viewAs }) ? (
        <button
          type="button"
          onClick={() => startTutorial()}
          className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 transition hover:bg-white/25"
        >
          <Compass size={12} /> Show this role&apos;s tutorial
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => void exit()}
        disabled={leaving}
        className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 transition hover:bg-white/25 disabled:opacity-60"
      >
        <LogOut size={12} /> {leaving ? "Exiting…" : "Exit"}
      </button>
    </div>
  );
}
