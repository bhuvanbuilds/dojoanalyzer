"use client";

import { useRouter } from "next/navigation";
import { studentHref } from "@/lib/student-links";

/** Open a student's profile page from anywhere on the dashboard. */
export function useStudentOpener() {
  const router = useRouter();
  return {
    openStudent: (id: string) => router.push(studentHref(id)),
  };
}
