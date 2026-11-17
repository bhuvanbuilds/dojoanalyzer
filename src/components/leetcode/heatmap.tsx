"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function addDays(day: string, delta: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/** Green shade for a day's count (0 = empty). */
function shade(count: number) {
  if (count <= 0) return "var(--heat-0)";
  if (count === 1) return "var(--heat-1)";
  if (count <= 3) return "var(--heat-2)";
  if (count <= 5) return "var(--heat-3)";
  return "var(--heat-4)";
}

/**
 * GitHub-style calendar: one column per week (Sunday on top), ending with the
 * week that holds `today`. Days after today are left blank.
 */
export function Heatmap({
  days,
  today,
  weeks = 18,
  cell = 11,
  gap = 3,
  showMonths = false,
  unit = "problems",
  className = "",
  fill = false,
}: {
  days: Record<string, number>;
  today: string;
  weeks?: number;
  cell?: number;
  gap?: number;
  showMonths?: boolean;
  unit?: string;
  className?: string;
  /** Show as many weeks as fit the container's width (up to `weeks`). */
  fill?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [fitted, setFitted] = useState<number | null>(null);
  useEffect(() => {
    const host = box.current;
    if (!fill || !host) return;
    const observer = new ResizeObserver(([entry]) => {
      const room = Math.floor((entry.contentRect.width + gap) / (cell + gap));
      setFitted(Math.max(4, Math.min(weeks, room)));
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [fill, weeks, cell, gap]);
  const shown = fill ? (fitted ?? Math.min(weeks, 26)) : weeks;

  const columns = useMemo(() => {
    const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
    const start = addDays(today, -weekday - (shown - 1) * 7);
    return Array.from({ length: shown }, (_, week) =>
      Array.from({ length: 7 }, (_, dow) => {
        const day = addDays(start, week * 7 + dow);
        return { day, future: day > today, count: days[day] ?? 0 };
      }),
    );
  }, [days, today, shown]);

  const width = shown * (cell + gap) - gap;
  const top = showMonths ? 14 : 0;
  const height = top + 7 * (cell + gap) - gap;

  const chart = (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`block max-w-full ${className}`}
      role="img"
      aria-label={`Activity over the last ${shown} weeks`}
      style={
        {
          "--heat-0": "color-mix(in srgb, var(--ink) 8%, transparent)",
          "--heat-1": "#9be9a8",
          "--heat-2": "#40c463",
          "--heat-3": "#30a14e",
          "--heat-4": "#216e39",
        } as React.CSSProperties
      }
    >
      {showMonths
        ? columns.map((column, index) => {
            const first = column[0].day;
            const previous = index ? columns[index - 1][0].day : null;
            if (previous && previous.slice(5, 7) === first.slice(5, 7)) return null;
            return (
              <text key={first} x={index * (cell + gap)} y={10} fontSize={10} fill="var(--muted)">
                {MONTHS[Number(first.slice(5, 7)) - 1]}
              </text>
            );
          })
        : null}
      {columns.map((column, week) =>
        column.map(({ day, future, count }, dow) =>
          future ? null : (
            <rect
              key={day}
              x={week * (cell + gap)}
              y={top + dow * (cell + gap)}
              width={cell}
              height={cell}
              rx={2.5}
              fill={shade(count)}
              stroke={day === today ? "var(--ink)" : undefined}
              strokeOpacity={day === today ? 0.5 : undefined}
              strokeWidth={day === today ? 1 : undefined}
            >
              <title>{`${count} ${count === 1 ? unit.replace(/s$/, "") : unit} · ${new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`}</title>
            </rect>
          ),
        ),
      )}
    </svg>
  );
  return fill ? (
    <div ref={box} className="w-full min-w-0">
      {chart}
    </div>
  ) : (
    chart
  );
}
