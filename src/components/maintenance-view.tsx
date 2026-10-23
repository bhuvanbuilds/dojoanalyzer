"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { LogIn, LogOut, RefreshCw } from "lucide-react";
import { FuzzyText } from "@/components/reactbits/fuzzy-text";
import { LightRays } from "@/components/reactbits/light-rays";
import { ShinyButton } from "@/components/ui/shiny-button";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

const AMBER = "#ffb347";
const EASE = [0.22, 1, 0.36, 1] as const;

// One shared one-second clock; the server renders placeholders instead.
function subscribeClock(onTick: () => void) {
  const timer = window.setInterval(onTick, 1000);
  return () => window.clearInterval(timer);
}
const clockSnapshot = () => Math.floor(Date.now() / 1000);
const serverClock = () => null;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/**
 * Always-dark "we're testing" screen for people who signed in before they
 * have an account. Mirrors the 404 page: rays, grain, a fuzzy headline
 * sinking off the bottom, and a live countdown to reopening.
 */
export function MaintenanceView({
  until,
  message,
  email,
}: {
  until: string | null;
  message: string | null;
  email: string | null;
}) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const nowSeconds = useSyncExternalStore(subscribeClock, clockSnapshot, serverClock);
  // No end time means "back soon": no countdown, just the message.
  const target = until ? new Date(until) : null;
  const left =
    nowSeconds === null || !target
      ? null
      : Math.max(0, Math.floor(target.getTime() / 1000) - nowSeconds);
  const live = left === 0;

  const parts =
    left === null
      ? null
      : {
          hours: Math.floor(left / 3600),
          minutes: Math.floor((left % 3600) / 60),
          seconds: left % 60,
        };

  const targetLabel = target
    ? target.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      })
    : null;
  const localLabel =
    nowSeconds === null || !target
      ? null
      : `${target.toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
        })} · ${target
          .toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
          })
          .replace("GMT+5:30", "IST")}`;

  const rise = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 18, filter: "blur(6px)" },
          animate: { opacity: 1, y: 0, filter: "blur(0px)" },
          transition: { delay, duration: 0.7, ease: EASE },
        };

  return (
    <main
      data-theme="dark"
      className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-[#09090b] text-white"
    >
      {/* Backdrop: warm rays, dot grid, grain, glow */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-75">
        <LightRays
          raysOrigin="top-center"
          raysColor={live ? "#7dffb0" : "#ffc58a"}
          raysSpeed={0.5}
          lightSpread={0.75}
          rayLength={1.5}
          fadeDistance={0.95}
          followMouse
          mouseInfluence={0.1}
          noiseAmount={0.08}
          distortion={0.05}
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-40 [background-image:radial-gradient(rgba(255,255,255,0.14)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-[0.07] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-[60%]"
        style={{
          background: live
            ? "radial-gradient(70% 90% at 50% 100%, rgba(52,211,153,0.2), transparent 70%)"
            : "radial-gradient(70% 90% at 50% 100%, rgba(255,140,60,0.2), transparent 70%)",
        }}
      />

      {/* Top bar */}
      <header className="flex items-center px-6 pt-6 sm:px-10">
        <motion.div {...rise(0)} className="flex items-center gap-2.5">
          <Image src="/imgs/kalvium_icon.jpg" alt="" width={30} height={30} className="rounded-lg" />
          <span className="whitespace-nowrap font-display text-[15px] font-bold tracking-[-0.02em]">
            Dojo Belt Analyzer
          </span>
        </motion.div>
      </header>

      {/* Message + countdown */}
      <section className="relative z-10 mx-auto mt-[7vh] flex w-full max-w-2xl flex-col items-center px-6 text-center">
        <motion.p
          {...rise(0.1)}
          className="font-mono text-[12px] uppercase tracking-[0.28em]"
          style={{ color: live ? "#7dffb0" : AMBER }}
        >
          {live ? "We’re back" : "Under maintenance"}
        </motion.p>
        <motion.h1
          {...rise(0.16)}
          className="mt-4 font-display text-[clamp(2rem,5.4vw,3.6rem)] font-extrabold leading-[1.02] tracking-[-0.04em] [text-shadow:0_10px_40px_rgba(0,0,0,0.55)]"
        >
          {live ? (
            "The dojo is open again."
          ) : !targetLabel ? (
            "We’ll be back soon."
          ) : (
            <>
              We’ll be back live at{" "}
              <span className="bg-gradient-to-r from-[#ffd29a] via-[#ffb347] to-[#ff7a59] bg-clip-text text-transparent">
                {targetLabel.toUpperCase()}
              </span>
            </>
          )}
        </motion.h1>
        <motion.p {...rise(0.22)} className="mt-4 max-w-lg text-[15px] leading-7 text-white/65">
          {live
            ? "Maintenance is done. Head back in and pick up where you left off."
            : (message ??
              "We’re improving Dojo Belt Analyzer and checking every belt, leaderboard and import. Hang tight — it’s worth the wait.")}
        </motion.p>

        {target ? (
        <motion.div
          {...rise(0.3)}
          role="timer"
          aria-live="off"
          aria-label={
            parts
              ? `${parts.hours} hours, ${parts.minutes} minutes and ${parts.seconds} seconds left`
              : "Countdown"
          }
          className="mt-9 flex items-start justify-center gap-2.5 sm:gap-4"
        >
          <Unit label="Hours" value={parts ? pad(parts.hours) : "--"} live={live} reduced={Boolean(reduced)} />
          <Colon live={live} />
          <Unit label="Minutes" value={parts ? pad(parts.minutes) : "--"} live={live} reduced={Boolean(reduced)} />
          <Colon live={live} />
          <Unit label="Seconds" value={parts ? pad(parts.seconds) : "--"} live={live} reduced={Boolean(reduced)} />
        </motion.div>
        ) : null}

        <motion.p
          {...rise(0.36)}
          className="mt-6 min-h-6 text-[14px] font-medium tracking-[-0.005em] text-white/50"
        >
          {localLabel ? (
            <>
              Doors open <span className="text-white/85">{localLabel}</span>
            </>
          ) : (
            "\u00a0"
          )}
        </motion.p>

        <motion.div {...rise(0.42)} className="mt-7 flex flex-wrap items-center justify-center gap-3">
          {email ? (
            <>
              <ShinyButton
                onClick={() => {
                  router.refresh();
                  router.push("/");
                }}
                className="h-11 px-5 font-display text-[14px] font-semibold"
              >
                <RefreshCw size={15} /> {live ? "Enter the dojo" : "Check again"}
              </ShinyButton>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 text-[14px] font-semibold text-white/85 backdrop-blur transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
                >
                  <LogOut size={15} /> Sign out
                </button>
              </form>
            </>
          ) : (
            <ShinyButton
              onClick={() => router.push("/login")}
              className="h-11 px-5 font-display text-[14px] font-semibold"
            >
              <LogIn size={15} /> Go to sign in
            </ShinyButton>
          )}
        </motion.div>
        {email ? (
          <motion.p {...rise(0.48)} className="mt-4 text-[12.5px] text-white/40">
            Signed in as <span className="text-white/70">{email}</span>
          </motion.p>
        ) : null}
      </section>

      {/* Fuzzy reopening time sinking off the bottom, like the 404 page */}
      <motion.div
        aria-hidden="true"
        initial={reduced ? false : { opacity: 0, y: 80 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 1.1, ease: EASE }}
        className="pointer-events-none mt-auto mb-[-10vw] flex w-full justify-center pt-10"
      >
        <FuzzyText
          key={live ? "live" : "soon"}
          text={live ? "LIVE" : targetLabel ? targetLabel.toUpperCase().replace(":00", "") : "SOON"}
          widthRatio={0.5}
          fontWeight={800}
          className="max-w-none font-display"
          gradient={
            live
              ? ["rgba(255,255,255,0.95)", "rgba(125,255,176,0.9)", "rgba(52,211,153,0.5)", "rgba(52,211,153,0)"]
              : ["rgba(255,255,255,0.95)", "rgba(255,197,138,0.9)", "rgba(255,140,60,0.55)", "rgba(255,140,60,0)"]
          }
        />
      </motion.div>
    </main>
  );
}

function Colon({ live }: { live: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="dojo-anim mt-[clamp(0.9rem,3vw,1.6rem)] animate-pulse font-display text-[clamp(1.6rem,5vw,2.6rem)] font-bold"
      style={{ color: live ? "#7dffb0" : AMBER }}
    >
      :
    </span>
  );
}

function Unit({
  label,
  value,
  live,
  reduced,
}: {
  label: string;
  value: string;
  live: boolean;
  reduced: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="flex gap-1.5">
        {value.split("").map((digit, index) => (
          <span
            key={index}
            className="relative flex h-[clamp(4rem,13vw,6.5rem)] w-[clamp(2.8rem,9vw,4.6rem)] items-center justify-center overflow-hidden rounded-2xl border bg-white/[0.045] font-display text-[clamp(2.4rem,8vw,4.2rem)] font-extrabold tabular-nums tracking-[-0.04em] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_40px_-18px_rgba(0,0,0,0.8)] backdrop-blur-md"
            style={{ borderColor: live ? "rgba(125,255,176,0.35)" : "rgba(255,255,255,0.1)" }}
          >
            {/* Split-flap seam */}
            <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-black/40" />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={digit}
                initial={reduced ? false : { y: "-70%", opacity: 0, filter: "blur(4px)" }}
                animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
                exit={reduced ? undefined : { y: "70%", opacity: 0, filter: "blur(4px)" }}
                transition={{ duration: 0.45, ease: EASE }}
                className="block"
              >
                {digit}
              </motion.span>
            </AnimatePresence>
          </span>
        ))}
      </div>
      <span className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-white/45">{label}</span>
    </div>
  );
}
