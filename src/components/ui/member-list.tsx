"use client";

import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";

// A Linear-style people/records list: a slim sticky header, then one quiet row
// per item with an avatar, a name and a muted second line, followed by fixed
// columns. Rows separate with faint rules and highlight on hover. Columns
// drop off on narrow screens via `hideBelow`.

export type MemberColumn<T> = {
  key: string;
  header: ReactNode;
  /** Tailwind width class, e.g. "w-32". Defaults to an auto-sized column. */
  width?: string;
  align?: "left" | "right";
  /** Hide this column below a breakpoint so rows never scroll sideways. */
  hideBelow?: "sm" | "md" | "lg";
  render: (row: T) => ReactNode;
};

export type MemberLead = {
  title: ReactNode;
  subtitle?: ReactNode;
  avatar?: { src?: string | null; name: string | null; seed: string };
  /** Dot on the avatar: green active now, gray not active, red never signed in. */
  presence?: "online" | "offline" | "never" | null;
  /** Shown on hover over the dot. */
  presenceLabel?: string;
};

const HIDE = { sm: "hidden sm:flex", md: "hidden md:flex", lg: "hidden lg:flex" } as const;
const PRESENCE = { online: "#22c55e", offline: "#a1a1aa", never: "#ef3837" } as const;

export function MemberList<T>({
  rows,
  rowKey,
  lead,
  leadHeader = "Name",
  columns,
  onRowClick,
  selectedKey,
  empty = "Nothing here yet.",
  className = "",
  ...rest
}: {
  rows: T[];
  rowKey: (row: T) => string;
  lead: (row: T) => MemberLead;
  leadHeader?: ReactNode;
  columns: MemberColumn<T>[];
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  empty?: ReactNode;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children">) {
  const cell = (column: MemberColumn<T>) =>
    `${column.hideBelow ? HIDE[column.hideBelow] : "flex"} ${column.width ?? "w-32"} shrink-0 items-center ${
      column.align === "right" ? "justify-end text-right" : ""
    }`;

  return (
    <div role="table" className={`w-full text-[13px] ${className}`} {...rest}>
      <div
        role="row"
        className="sticky top-[var(--app-bar-h,57px)] z-10 flex items-center gap-4 border-b border-line bg-surface/95 px-4 py-2 text-[11.5px] font-medium text-muted backdrop-blur sm:px-5"
      >
        <div role="columnheader" className="min-w-0 flex-1">
          {leadHeader}
        </div>
        {columns.map((column) => (
          <div key={column.key} role="columnheader" className={cell(column)}>
            {column.header}
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-[13px] text-muted sm:px-5">{empty}</p>
      ) : (
        <div role="rowgroup">
          {rows.map((row) => {
            const key = rowKey(row);
            const info = lead(row);
            const selected = selectedKey === key;
            return (
              <div
                key={key}
                role="row"
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                aria-selected={onRowClick ? selected : undefined}
                className={`flex items-center gap-4 border-b border-line/60 px-4 py-2.5 transition-colors last:border-b-0 sm:px-5 ${
                  selected ? "bg-sunken" : "hover:bg-sunken/60"
                } ${onRowClick ? "cursor-pointer outline-none focus-visible:bg-sunken" : ""}`}
              >
                <div role="cell" className="flex min-w-0 flex-1 items-center gap-3">
                  {info.avatar ? (
                    <span className="relative shrink-0">
                      <Avatar src={info.avatar.src} name={info.avatar.name} seed={info.avatar.seed} size={30} />
                      {info.presence ? (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface"
                          style={{ backgroundColor: PRESENCE[info.presence] }}
                          title={info.presenceLabel}
                        >
                          <span className="sr-only">{info.presenceLabel ?? info.presence}</span>
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink">{info.title}</div>
                    {info.subtitle ? <div className="truncate text-[12px] text-muted">{info.subtitle}</div> : null}
                  </div>
                </div>
                {columns.map((column) => (
                  <div key={column.key} role="cell" className={`${cell(column)} min-w-0 text-[12.5px] text-ink-2`}>
                    {column.render(row)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Small neutral label for roles, statuses and the like. */
export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brand" | "warning" | "success" }) {
  const tones = {
    neutral: "bg-sunken text-ink-2",
    brand: "bg-brand-soft text-brand-text",
    warning: "bg-warning-soft text-warning-text",
    success: "bg-success-soft text-success-text",
  };
  return (
    <span className={`inline-flex max-w-full items-center truncate rounded-md px-1.5 py-0.5 text-[11.5px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
