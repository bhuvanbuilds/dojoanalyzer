"use client";

/**
 * Flowing aurora ribbons over a domain-warped noise field (WebGL via ogl).
 * Follows the cursor a little, pauses when off screen or the tab is hidden,
 * and draws one still frame for people who prefer reduced motion.
 */

import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";

const vertex = /* glsl */ `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const fragment = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform vec3 uBase;
uniform vec3 uMid;
uniform vec3 uGlow;
uniform float uIntensity;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  p += (uMouse - 0.5) * vec2(0.18, -0.12);
  float t = uTime * 0.08;

  vec2 q = vec2(fbm(p * 1.2 + t), fbm(p * 1.2 - t + 3.1));
  vec2 r = vec2(fbm(p * 1.6 + 2.0 * q + vec2(1.7, 9.2) + t * 1.5), fbm(p * 1.6 + 2.0 * q + vec2(8.3, 2.8) - t));
  float field = fbm(p * 1.4 + 2.4 * r);

  // Three ribbons that sway with time and bend with the warped field.
  float ribbons = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float y = p.y * 1.5 + 0.32 * sin(p.x * 1.7 + t * 6.0 + fi * 2.1) + (r.x - 0.5) * 0.9 - (fi - 1.0) * 0.36;
    ribbons += smoothstep(0.24, 0.0, abs(y)) * (0.62 - fi * 0.14);
  }

  vec3 col = mix(uBase, uMid, clamp(field * 1.25, 0.0, 1.0));
  col = mix(col, uGlow, clamp(ribbons, 0.0, 1.0) * 0.8);
  col += uGlow * pow(clamp(ribbons, 0.0, 1.0), 3.0) * 0.45;

  float vignette = smoothstep(1.3, 0.15, length(p * vec2(0.75, 1.1)));
  col *= mix(0.35, 1.0, vignette) * uIntensity;
  col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.03;
  gl_FragColor = vec4(col, 1.0);
}
`;

const rgb = (hex: string) => {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export function AuroraShader({
  base = "#08080b",
  mid = "#2a0f12",
  glow = "#ef3837",
  intensity = 1,
  speed = 1,
  className = "",
}: {
  base?: string;
  mid?: string;
  glow?: string;
  intensity?: number;
  speed?: number;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const colors = useRef({ base, mid, glow, intensity, speed });
  // Latest colours for the render loop, without rebuilding the WebGL context.
  useEffect(() => {
    colors.current = { base, mid, glow, intensity, speed };
  }, [base, mid, glow, intensity, speed]);

  useEffect(() => {
    const host = container.current;
    if (!host) return;
    const renderer = new Renderer({ alpha: false, antialias: false, dpr: Math.min(window.devicePixelRatio || 1, 1.5) });
    const gl = renderer.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.cssText = "width:100%;height:100%;display:block";
    host.appendChild(canvas);

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        uTime: { value: 0 },
        uRes: { value: [1, 1] },
        uMouse: { value: [0.5, 0.5] },
        uBase: { value: rgb(base) },
        uMid: { value: rgb(mid) },
        uGlow: { value: rgb(glow) },
        uIntensity: { value: intensity },
      },
    });
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    const resize = () => {
      const box = host.getBoundingClientRect();
      renderer.setSize(Math.max(1, box.width), Math.max(1, box.height));
      program.uniforms.uRes.value = [gl.drawingBufferWidth, gl.drawingBufferHeight];
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    // The cursor eases towards its target instead of snapping.
    const target = [0.5, 0.5];
    const mouse = [0.5, 0.5];
    const onMove = (event: PointerEvent) => {
      const box = host.getBoundingClientRect();
      target[0] = (event.clientX - box.left) / box.width;
      target[1] = (event.clientY - box.top) / box.height;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = true;
    const seen = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    seen.observe(host);

    let frame = 0;
    let last = performance.now();
    let time = 7;
    const draw = (now: number) => {
      const { base: b, mid: m, glow: g, intensity: i, speed: s } = colors.current;
      program.uniforms.uBase.value = rgb(b);
      program.uniforms.uMid.value = rgb(m);
      program.uniforms.uGlow.value = rgb(g);
      program.uniforms.uIntensity.value = i;
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (visible && !document.hidden) {
        time += delta * s;
        mouse[0] += (target[0] - mouse[0]) * 0.04;
        mouse[1] += (target[1] - mouse[1]) * 0.04;
        program.uniforms.uTime.value = time;
        program.uniforms.uMouse.value = mouse;
        renderer.render({ scene: mesh });
      }
      if (!reduce) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      seen.disconnect();
      window.removeEventListener("pointermove", onMove);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
    // Colours update through the ref; the context is built once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={container} aria-hidden="true" className={`absolute inset-0 ${className}`} />;
}
