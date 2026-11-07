"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { UserRound } from "lucide-react";
import { LeetCodeLogo } from "@/components/leetcode/leetcode-logo";

/** Overview | LeetCode switch at the top of a student's profile. */
export function ProfileTabs({ studentId, active, staff }: { studentId: string; active: "overview" | "leetcode"; staff: boolean }) {
  const tabs = [
    { id: "overview" as const, label: "Overview", href: staff ? `/students/${studentId}/history` : `/student/${studentId}`, icon: <UserRound size={14} /> },
    { id: "leetcode" as const, label: "LeetCode", href: `/student/${studentId}/leetcode`, icon: <LeetCodeLogo size={14} /> },
  ];
  return (
    <nav aria-label="Profile sections" className="flex gap-1 border-b border-line px-3 sm:px-4">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          aria-current={tab.id === active ? "page" : undefined}
          className={`relative inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold transition ${tab.id === active ? "text-ink" : "text-muted hover:text-ink"}`}
        >
          {tab.icon}
          {tab.label}
          {tab.id === active ? <motion.span layoutId="profile-tab" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" /> : null}
        </Link>
      ))}
    </nav>
  );
}
