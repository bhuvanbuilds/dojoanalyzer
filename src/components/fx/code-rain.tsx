"use client";

/**
 * Code symbols drifting upward in three depths, nudged away from the cursor.
 * Now and then one lights up. Canvas 2D; pauses off screen; static for
 * reduced motion.
 */

import { useEffect, useRef } from "react";

const GLYPHS = ["{ }", "( )", "[ ]", "=>", "++", "==", "!=", "&&", "||", ";", "</>", "O(n)", "O(1)", "log n", "i++", "fn", "if", "for", "while", "return", "0", "1", "∑", "λ", "#", "%", "<<", ">>", "?:", "::"];

type Glyph = { x: number; y: number; z: number; text: string; vy: number; drift: number; phase: number; lit: number };

export function CodeRain({
  color = "255,255,255",
  accent = "255,161,22",
  density = 1,
  className = "",
}: {
  /** "r,g,b" for the symbols. */
  color?: string;
  /** "r,g,b" for the occasional lit symbol. */
  accent?: string;
  density?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ctx = context;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let glyphs: Glyph[] = [];

    const spawn = (anywhere: boolean): Glyph => {
      const z = 0.25 + Math.random() * 0.75;
      return {
        x: Math.random() * width,
        y: anywhere ? Math.random() * height : height + 20,
        z,
        text: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
        vy: (10 + Math.random() * 22) * z,
        drift: (Math.random() - 0.5) * 6,
        phase: Math.random() * Math.PI * 2,
        lit: 0,
      };
    };

    const resize = () => {
      const box = canvas.getBoundingClientRect();
      width = box.width;
      height = box.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(((width * height) / 11000) * density);
      glyphs = Array.from({ length: Math.min(160, count) }, () => spawn(true));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();


    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = true;
    const seen = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    seen.observe(canvas);

    let frame = 0;
    let last = performance.now();
    // 30 fps is plenty for an ambient background and leaves the main thread
    // free, so clicks and hovers on top of it respond at once.
    let lastPaint = 0;
    const draw = (now: number) => {
      if (now - lastPaint < 32) {
        if (!reduce) frame = requestAnimationFrame(draw);
        return;
      }
      lastPaint = now;
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (visible && !document.hidden) {
        ctx.clearRect(0, 0, width, height);
        for (let index = 0; index < glyphs.length; index += 1) {
          const glyph = glyphs[index];
          glyph.phase += delta;
          glyph.y -= glyph.vy * delta;
          glyph.x += Math.sin(glyph.phase) * glyph.drift * delta;
          if (Math.random() < 0.0006) glyph.lit = 1;
          glyph.lit = Math.max(0, glyph.lit - delta * 0.7);
          if (glyph.y < -30) glyphs[index] = spawn(false);

          const size = 9 + glyph.z * 13;
          const fadeEdges = Math.min(1, glyph.y / 80, (height - glyph.y) / 60);
          const alpha = (0.05 + glyph.z * 0.22) * Math.max(0, fadeEdges);
          ctx.font = `${glyph.z > 0.7 ? 600 : 500} ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
          if (glyph.lit > 0) {
            ctx.fillStyle = `rgba(${accent},${Math.min(1, alpha + glyph.lit * 0.75)})`;
            ctx.shadowColor = `rgba(${accent},${glyph.lit * 0.8})`;
            ctx.shadowBlur = 12 * glyph.lit;
          } else {
            ctx.fillStyle = `rgba(${color},${alpha})`;
            ctx.shadowBlur = 0;
          }
          ctx.fillText(glyph.text, glyph.x, glyph.y);
        }
        ctx.shadowBlur = 0;
      }
      if (!reduce) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      seen.disconnect();
    };
  }, [color, accent, density]);

  return <canvas ref={canvasRef} aria-hidden="true" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
}
