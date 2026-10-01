"use client";

import Link from "next/link";
import { isTabActive, type NavGroup } from "@/components/navigation";

/** Underlined tab strip, attached under the navbar, for pages in one group. */
export function SectionTabs({
  group,
  pathname,
}: {
  group: NavGroup;
  pathname: string;
}) {
  if (group.tabs.length < 2) return null;

  return (
    <div className="border-t border-line">
      <nav
        aria-label={`${group.label} sections`}
        className="mx-auto flex h-10 max-w-[2200px] items-stretch gap-1 overflow-x-auto px-2 sm:px-3"
      >
        {group.tabs.map((tab) => {
          const active = isTabActive(tab, pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3 font-display text-[13px] font-semibold tracking-[-0.01em] outline-none transition-colors duration-200 focus-visible:bg-ink/5 ${
                active ? "text-ink" : "text-muted hover:text-ink"
              }`}
            >
              <Icon
                size={15}
                strokeWidth={2}
                className={active ? "text-brand-text" : "text-faint"}
              />
              {tab.label}
              <span
                aria-hidden="true"
                className={`absolute inset-x-2 -bottom-px h-[2px] transition-colors ${
                  active ? "bg-brand" : "bg-transparent"
                }`}
              />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
