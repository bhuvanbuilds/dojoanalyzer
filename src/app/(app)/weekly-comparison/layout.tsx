import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Weekly comparison" };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
