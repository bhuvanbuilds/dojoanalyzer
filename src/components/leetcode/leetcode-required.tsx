"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const LINK_PAGE = "/student/leetcode";

/**
 * LeetCode is mandatory for students: until one is linked, any page sends
 * them to My LeetCode to add it. Staff, and developers viewing as a student,
 * are never redirected (the API reports them as linked).
 */
export function LeetCodeRequired() {
  const pathname = usePathname();
  const router = useRouter();
  const linked = useRef(false);

  useEffect(() => {
    if (linked.current || pathname.startsWith(LINK_PAGE)) return;
    let active = true;
    fetch("/api/leetcode/me/linked", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { linked: true }))
      .then((result: { linked?: boolean }) => {
        if (!active) return;
        if (result.linked !== false) linked.current = true;
        else router.replace(`${LINK_PAGE}?required=1`);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pathname, router]);

  return null;
}
