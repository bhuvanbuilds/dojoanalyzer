"use client";

import dynamic from "next/dynamic";

// The 404 scene (motion + WebGL) is part of every route's boundary; loading it
// on demand keeps it out of the startup bundle of every other page.
export const LazyNotFoundView = dynamic(
  () => import("@/components/not-found-view").then((module) => module.NotFoundView),
  { ssr: false, loading: () => <div className="h-dvh min-h-[560px] bg-[#09090b]" /> },
);
