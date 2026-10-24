"use client";

import { useEffect } from "react";

const EVERY = 2 * 60_000;

/** Tells the server this person is using the app while a tab is visible. */
export function PresenceHeartbeat() {
  useEffect(() => {
    let last = 0;
    const beat = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < EVERY - 5_000) return;
      last = Date.now();
      void fetch("/api/presence", { method: "POST", keepalive: true }).catch(() => undefined);
    };
    beat();
    const timer = window.setInterval(beat, EVERY);
    document.addEventListener("visibilitychange", beat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, []);
  return null;
}
