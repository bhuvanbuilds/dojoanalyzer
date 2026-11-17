"use client";

import Image from "next/image";
import { TextType } from "@/components/reactbits/text-type";

export type BotMood = "idle" | "focus" | "loading" | "error";

// ─── Stage ────────────────────────────────────────────────────────────────────
// Left side of the login page: a still dot grid, the Kalvium logo and the
// app's name typed out. Sizes for every screen width live in globals.css
// (.login-stage / .login-title).
export function DojoStage({ mood }: { mood: BotMood }) {
  return (
    <div className="login-stage relative flex h-full flex-col overflow-hidden bg-[#0b0b0d] text-white">
      {/* Dot grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[60%] aspect-square w-[min(620px,120%)] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-500"
        style={{
          background: "radial-gradient(circle, rgba(239,56,55,0.16) 0%, transparent 60%)",
          opacity: mood === "error" ? 1 : mood === "focus" || mood === "loading" ? 0.85 : 0.6,
        }}
      />

      {/* Logo */}
      <div className="login-pad relative z-10 pt-6 sm:pt-9 lg:pt-12">
        <Image
          src="/imgs/kalvium_extended_logo.png"
          alt="Kalvium"
          width={2560}
          height={543}
          sizes="160px"
          preload
          className="h-7 w-auto lg:h-8"
        />
      </div>

      {/* Name */}
      <div className="login-pad relative z-10 mt-auto pb-8 sm:pb-10 lg:pb-14">
        <div
          key={mood === "error" ? "shake" : "still"}
          className={mood === "error" ? "dojo-anim animate-[dojo-shake_0.5s_ease-in-out]" : ""}
        >
          <h2 className="login-title font-display font-extrabold">
            <TextType text={"Dojo Belt\nAnalyzer"} loop={false} cursorClassName="text-[#ef3837]" />
          </h2>
        </div>
        <p className="login-tagline mt-4 max-w-md leading-relaxed text-white/55 sm:mt-5">
          Weekly belt progress for every student, squad and campus.
        </p>
      </div>
    </div>
  );
}
