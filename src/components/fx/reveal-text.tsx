"use client";

/** Words rise and sharpen into place one after another. */

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export function RevealText({
  parts,
  className = "",
  delay = 0,
  stagger = 0.07,
}: {
  /** Words or styled pieces, revealed in order. Strings are split into words. */
  parts: ReactNode[];
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const reduce = useReducedMotion();
  const pieces = parts.flatMap((part, index) =>
    typeof part === "string" ? part.split(/\s+/).filter(Boolean).map((word, at) => ({ key: `${index}-${at}`, node: word as ReactNode })) : [{ key: `${index}`, node: part }],
  );
  return (
    <span className={className}>
      {pieces.map((piece, index) => (
        <motion.span
          key={piece.key}
          className="inline-block whitespace-pre"
          initial={reduce ? false : { opacity: 0, y: "0.45em", filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: delay + index * stagger, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {piece.node}
          {index < pieces.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </span>
  );
}
