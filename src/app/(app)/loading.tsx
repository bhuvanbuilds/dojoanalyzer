import { PageSkeleton } from "@/components/ui/skeleton";

/**
 * Shown the moment a page link is clicked, while the next page loads, so a
 * click always gets an instant response.
 */
export default function Loading() {
  return <PageSkeleton label="Loading" />;
}
