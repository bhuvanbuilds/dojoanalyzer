"use client";

/**
 * Liquid glass for floating controls (tab switchers, pills, toolbars), never
 * for content cards: per Apple's rule, glass belongs to the functional layer.
 * A blurred, saturated backdrop, a bright rim, an inner edge highlight, and a
 * specular glint that follows the pointer.
 */

import { useRef, type CSSProperties, type ReactNode } from "react";

export function LiquidGlass({
  children,
  className = "",
  style,
  tone = "dark",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** "dark" over dark stages, "light" over light page backgrounds. */
  tone?: "dark" | "light";
  as?: "div" | "nav" | "span";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const light = tone === "light";
  return (
    <Tag
      ref={(node: HTMLElement | null) => {
        ref.current = node;
      }}
      onPointerMove={(event) => {
        const node = ref.current;
        if (!node) return;
        const box = node.getBoundingClientRect();
        node.style.setProperty("--glint-x", `${((event.clientX - box.left) / box.width) * 100}%`);
        node.style.setProperty("--glint-y", `${((event.clientY - box.top) / box.height) * 100}%`);
      }}
      className={`relative isolate overflow-hidden ${className}`}
      style={
        {
          "--glint-x": "30%",
          "--glint-y": "0%",
          background: light
            ? "linear-gradient(135deg, rgba(255,255,255,0.72), rgba(255,255,255,0.42))"
            : "linear-gradient(135deg, rgba(255,255,255,0.13), rgba(255,255,255,0.035))",
          backdropFilter: "blur(18px) saturate(180%)",
          WebkitBackdropFilter: "blur(18px) saturate(180%)",
          border: light ? "1px solid rgba(255,255,255,0.8)" : "1px solid rgba(255,255,255,0.16)",
          boxShadow: light
            ? "inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(0,0,0,0.06), 0 12px 32px -14px rgba(0,0,0,0.25)"
            : "inset 0 1px 0 rgba(255,255,255,0.32), inset 0 -1px 0 rgba(255,255,255,0.05), inset 0 0 18px rgba(255,255,255,0.04), 0 14px 36px -14px rgba(0,0,0,0.7)",
          ...style,
        } as CSSProperties
      }
    >
      {/* Specular glint that tracks the pointer. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 transition-opacity duration-300"
        style={{
          background: `radial-gradient(160px circle at var(--glint-x) var(--glint-y), rgba(255,255,255,${light ? 0.55 : 0.18}), transparent 70%)`,
        }}
      />
      {/* Curved top highlight, like light bending over a lens. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[3%] top-0 -z-10 h-6 rounded-b-[50%]"
        style={{ background: `linear-gradient(180deg, rgba(255,255,255,${light ? 0.45 : 0.08}), transparent)` }}
      />
      {children}
    </Tag>
  );
}
