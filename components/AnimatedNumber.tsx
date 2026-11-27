"use client";

// Renders a money amount that glides to its new value when it changes.
// Screen readers get the final value only; the moving digits are hidden.
// Honors prefers-reduced-motion by jumping straight to the value.
import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  format: (n: number) => string;
  duration?: number; // ms
};

export default function AnimatedNumber({ value, format, duration = 450 }: Props) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    if (reduce || from === value) {
      fromRef.current = value;
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const current = t === 1 ? value : from + (value - from) * eased;
      fromRef.current = current;
      setShown(current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return (
    <>
      <span aria-hidden className="tabular-nums">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
