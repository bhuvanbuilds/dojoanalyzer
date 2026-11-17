"use client";

/**
 * Text Type (after React Bits): types each phrase, pauses, deletes it and
 * moves to the next, with a blinking cursor. The longest phrase is laid out
 * invisibly underneath, so the block keeps one size while it types and
 * nothing around it jumps. Reduced motion shows the first phrase, still.
 */

import { useEffect, useState } from "react";

export function TextType({
  text,
  className = "",
  typingSpeed = 70,
  deletingSpeed = 35,
  pauseDuration = 2200,
  initialDelay = 300,
  loop = true,
  cursorCharacter = "|",
  cursorClassName = "",
}: {
  text: string | string[];
  className?: string;
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
  initialDelay?: number;
  loop?: boolean;
  cursorCharacter?: string;
  cursorClassName?: string;
}) {
  const phrases = Array.isArray(text) ? text : [text];
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [still, setStill] = useState(false);
  const phrase = phrases[index % phrases.length];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setStill(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (still) return;
    const lastPhrase = index % phrases.length === phrases.length - 1;
    let delay: number;
    let step: () => void;
    if (!deleting && shown.length < phrase.length) {
      delay = shown.length === 0 && index === 0 ? initialDelay : typingSpeed;
      step = () => setShown(phrase.slice(0, shown.length + 1));
    } else if (!deleting) {
      if (!loop && lastPhrase) return;
      if (phrases.length === 1 && !loop) return;
      delay = pauseDuration;
      step = () => setDeleting(true);
    } else if (shown.length > 0) {
      delay = deletingSpeed;
      step = () => setShown(phrase.slice(0, shown.length - 1));
    } else {
      delay = typingSpeed * 3;
      step = () => {
        setDeleting(false);
        setIndex((current) => current + 1);
      };
    }
    const timer = window.setTimeout(step, delay);
    return () => window.clearTimeout(timer);
  }, [still, shown, deleting, phrase, index, phrases.length, typingSpeed, deletingSpeed, pauseDuration, initialDelay, loop]);

  const longest = phrases.reduce((a, b) => (b.length > a.length ? b : a), "");
  const visible = still ? phrases[0] : shown;

  return (
    <span className={`relative inline-grid ${className}`}>
      {/* Reserves the size of the longest phrase. */}
      <span aria-hidden="true" className="invisible col-start-1 row-start-1">
        {longest}
        <span className={cursorClassName}>{cursorCharacter}</span>
      </span>
      <span className="col-start-1 row-start-1" aria-label={phrases[0]}>
        <span aria-hidden="true">{visible}</span>
        <span aria-hidden="true" className={`text-type-cursor ${cursorClassName}`}>
          {cursorCharacter}
        </span>
      </span>
    </span>
  );
}
