"use client";

/**
 * Warm sparks rising and swaying, brighter near the bottom (like heat off a
 * podium). Canvas 2D with pre-rendered glow sprites; pauses off screen.
 */

import { useEffect, useRef } from "react";

type Spark = { x: number; y: number; r: number; vy: number; sway: number; phase: number; life: number; hue: number };

export function Embers({ density = 1, className = "" }: { density?: number; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const ctx = context;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let sparks: Spark[] = [];

    // One soft glow sprite per hue, drawn once and stamped every frame.
    const sprite = (hue: number) => {
      const size = 64;
      const off = document.createElement("canvas");
      off.width = off.height = size;
      const g = off.getContext("2d")!;
      const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, `hsla(${hue},100%,85%,1)`);
      gradient.addColorStop(0.25, `hsla(${hue},100%,60%,0.65)`);
      gradient.addColorStop(1, `hsla(${hue},100%,50%,0)`);
      g.fillStyle = gradient;
      g.fillRect(0, 0, size, size);
      return off;
    };
    const sprites = [28, 36, 44, 18].map(sprite);

    const spawn = (anywhere: boolean): Spark => ({
      x: Math.random() * width,
      y: anywhere ? Math.random() * height : height + 10,
      r: 1 + Math.random() * 2.6,
      vy: 18 + Math.random() * 46,
      sway: 6 + Math.random() * 16,
      phase: Math.random() * Math.PI * 2,
      life: 0.6 + Math.random() * 0.4,
      hue: Math.floor(Math.random() * sprites.length),
    });

    const resize = () => {
      const box = canvas.getBoundingClientRect();
      width = box.width;
      height = box.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sparks = Array.from({ length: Math.min(140, Math.round(((width * height) / 9000) * density)) }, () => spawn(true));
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
    const draw = (now: number) => {
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (visible && !document.hidden) {
        ctx.clearRect(0, 0, width, height);
        ctx.globalCompositeOperation = "lighter";
        for (let index = 0; index < sparks.length; index += 1) {
          const spark = sparks[index];
          spark.phase += delta * 1.6;
          spark.y -= spark.vy * delta;
          const x = spark.x + Math.sin(spark.phase) * spark.sway;
          const heightShare = spark.y / height;
          const alpha = Math.max(0, Math.min(1, heightShare * 1.4)) * spark.life * (0.6 + 0.4 * Math.sin(spark.phase * 3));
          if (spark.y < -10 || alpha <= 0.01) {
            sparks[index] = spawn(false);
            continue;
          }
          const size = spark.r * 7;
          ctx.globalAlpha = alpha;
          ctx.drawImage(sprites[spark.hue], x - size / 2, spark.y - size / 2, size, size);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
      if (!reduce) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      seen.disconnect();
    };
  }, [density]);

  return <canvas ref={canvasRef} aria-hidden="true" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
}
