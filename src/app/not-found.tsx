import type { Metadata } from "next";
import { LazyNotFoundView } from "@/components/not-found-lazy";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return <LazyNotFoundView />;
}
