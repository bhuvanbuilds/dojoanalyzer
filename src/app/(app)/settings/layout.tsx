import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { default: "Settings", template: "%s · Dojo Belt Analyzer" },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
