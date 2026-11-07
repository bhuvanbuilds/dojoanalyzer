"use client";

/**
 * A card that tilts towards the pointer and lights its surface and border
 * where the pointer is. Calm (no tilt) for reduced motion.
 */

import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";

export function SpotlightCard({
  children,
  className = "",
  glow = "239,56,55",
  tilt = 5,
}: {
  children: ReactNode;
  className?: string;
  /** "r,g,b" of the light. */
  glow?: string;
  /** Maximum tilt in degrees (0 for none). */
  tilt?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const rx = useSpring(useMotionValue(0), { stiffness: 180, damping: 18 });
  const ry = useSpring(useMotionValue(0), { stiffness: 180, damping: 18 });

  return (
    <motion.div
      ref={ref}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onPointerMove={(event) => {
        const node = ref.current;
        if (!node) return;
        const box = node.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width;
        const y = (event.clientY - box.top) / box.height;
        node.style.setProperty("--spot-x", `${x * 100}%`);
        node.style.setProperty("--spot-y", `${y * 100}%`);
        node.style.setProperty("--spot-o", "1");
        if (!reduce && tilt) {
          ry.set((x - 0.5) * tilt * 2);
          rx.set(-(y - 0.5) * tilt * 2);
        }
      }}
      onPointerLeave={() => {
        ref.current?.style.setProperty("--spot-o", "0");
        rx.set(0);
        ry.set(0);
      }}
      className={`group relative ${className}`}
    >
      {/* Light on the surface. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] transition-opacity duration-300"
        style={{
          opacity: "var(--spot-o, 0)",
          background: `radial-gradient(420px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(${glow},0.12), transparent 60%)`,
        }}
      />
      {/* Light on the border: a ring masked to the edge. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] p-px transition-opacity duration-300"
        style={{
          opacity: "var(--spot-o, 0)",
          background: `radial-gradient(260px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(${glow},0.75), transparent 65%)`,
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
      <div className="relative z-[1] h-full">{children}</div>
    </motion.div>
  );
}
