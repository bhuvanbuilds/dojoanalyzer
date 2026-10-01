"use client";

/**
 * Page layout primitives. Every app page is one ruled sheet: a single bordered
 * Frame that spans the viewport, whose sections and tiles are separated by
 * hairline borders instead of floating as separate rounded cards.
 *
 *   <Page>
 *     <Frame>
 *       <FrameTitle title="Students" actions={…} />
 *       <Cells className="sm:grid-cols-4">…<Cell>…</Cell></Cells>
 *       <Split className="xl:grid-cols-2"><Panel title="A" /><Panel title="B" /></Split>
 *       <Panel title="Table">…</Panel>
 *     </Frame>
 *   </Page>
 */

import { useRef, type HTMLAttributes, type ReactNode } from "react";

/** Full-width page canvas with a thin gutter below the sticky navbar. */
export function Page({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={`mx-auto w-full max-w-[2200px] px-2 pb-6 pt-2 sm:px-3 sm:pt-3 ${className}`}
    >
      {children}
    </main>
  );
}

/**
 * The one parent surface. Direct children are stacked and divided by a
 * hairline; the first and last child inherit the frame's corners so dark or
 * tinted sections don't poke out.
 */
export function Frame({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative divide-y divide-line rounded-xl border border-line bg-surface shadow-[var(--card-shadow)] [&>:first-child]:rounded-t-[11px] [&>:last-child]:rounded-b-[11px] ${className}`}
    >
      {children}
    </div>
  );
}

/** Title row at the top of a frame: eyebrow, heading, description, actions. */
export function FrameTitle({
  eyebrow,
  title,
  description,
  actions,
  className = "",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={`flex flex-col gap-4 bg-surface-2 px-4 py-4 sm:px-5 lg:flex-row lg:items-end lg:justify-between ${className}`}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-brand-text">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-0.5 font-display text-[24px] font-bold leading-tight tracking-[-0.03em] text-ink sm:text-[28px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-[13.5px] leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-end gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

/** A titled section inside a frame. It has no border of its own. */
export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
  bodyClassName = "",
  as: Tag = "section",
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: "section" | "div";
}) {
  return (
    <Tag className={`min-w-0 ${className}`}>
      {title || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title ? (
              <h2 className="font-display text-[15px] font-bold tracking-[-0.015em] text-ink">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="text-[12.5px] text-muted">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </Tag>
  );
}

/**
 * Side-by-side panels inside a frame. Pass the column template via className
 * (e.g. "xl:grid-cols-2"); dividers switch from horizontal to vertical at xl.
 */
export function Split({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`grid divide-y divide-line xl:divide-x xl:divide-y-0 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Classes for a grid of tiles separated by 1px rules. Each child draws a 1px
 * outline into the gap; the container clips the outer edge so the rules only
 * appear between tiles, and a short last row leaves blank surface, not grey.
 */
export const cellsClass =
  "grid gap-px overflow-hidden bg-surface [&>*]:shadow-[0_0_0_1px_var(--line)]";

/** A grid of tiles separated by 1px rules. Set columns via className. */
export function Cells({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`${cellsClass} ${className}`}>{children}</div>;
}

/**
 * One tile in a Cells grid, with a soft spotlight that follows the cursor.
 * Spotlight adapted from React Bits "SpotlightCard" (https://reactbits.dev) by
 * David Haz, MIT + Commons Clause: the position is written to CSS variables
 * so moving the mouse doesn't re-render the children.
 */
export function Cell({
  children,
  className = "",
  spotlight = true,
  spotlightColor = "color-mix(in srgb, var(--brand) 7%, transparent)",
  style,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  spotlight?: boolean;
  spotlightColor?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function move(event: React.PointerEvent<HTMLDivElement>) {
    const cell = ref.current;
    if (!cell) return;
    const rect = cell.getBoundingClientRect();
    cell.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    cell.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onPointerMove={spotlight ? move : undefined}
      className={`group/cell relative min-w-0 bg-surface ${className}`}
      style={style}
      {...rest}
    >
      {spotlight ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/cell:opacity-100"
          style={{
            background: `radial-gradient(320px circle at var(--spot-x, 50%) var(--spot-y, 50%), ${spotlightColor}, transparent 75%)`,
          }}
        />
      ) : null}
      <div className="relative flex h-full flex-col">{children}</div>
    </div>
  );
}

/** Empty / error message row inside a frame. */
export function FrameMessage({
  title,
  children,
  className = "",
}: {
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`px-6 py-14 text-center ${className}`}>
      {title ? (
        <p className="font-display text-[16px] font-bold text-ink">{title}</p>
      ) : null}
      {children ? (
        <div className="mt-1.5 text-sm text-muted">{children}</div>
      ) : null}
    </div>
  );
}
