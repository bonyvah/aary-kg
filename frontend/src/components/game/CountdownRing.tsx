"use client";

import { useState, type CSSProperties } from "react";
import { cx } from "@/lib/cx";

type CountdownRingProps = {
  /** Seconds left, from the server's clock. */
  remaining: number;
  total: number;
  /** Translated unit, e.g. «сек». */
  unit: string;
  size?: "default" | "lg";
  className?: string;
};

const RADIUS = 44;
const LENGTH = 2 * Math.PI * RADIUS;

/**
 * The reading time before a question's answers open: a ring that empties, the seconds left in the
 * middle. It runs once, smoothly, from where it was when it appeared (remount it for the next
 * question); with reduced motion it steps with the seconds instead. Only draws the server's clock.
 */
export function CountdownRing({ remaining, total, unit, size = "default", className }: CountdownRingProps) {
  const [start] = useState(() => ({ remaining, total }));
  const share = (left: number) => (total > 0 ? Math.min(1, Math.max(0, left / total)) : 0);
  // Runtime values, so they travel as CSS variables (like the timer bar's fill).
  const ringVars = {
    "--ring-length": `${LENGTH}`,
    "--ring-from": `${LENGTH * (1 - (start.total > 0 ? Math.min(1, start.remaining / start.total) : 0))}`,
    "--ring-now": `${LENGTH * (1 - share(remaining))}`,
    "--ring-duration": `${Math.max(0, start.remaining)}s`,
  } as CSSProperties;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={remaining}
      aria-valuetext={`${remaining} ${unit}`}
      className={cx("relative grid place-items-center text-ink", size === "lg" ? "size-[240px]" : "size-[160px]", className)}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" className="absolute inset-0 size-full -rotate-90">
        <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="10" className="stroke-surface-raised" />
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={LENGTH}
          style={ringVars}
          className="stroke-accent [stroke-dashoffset:var(--ring-now)] motion-safe:animate-[ring-empty_var(--ring-duration)_linear_forwards]"
        />
      </svg>
      <span className={cx("font-black tabular-nums", size === "lg" ? "text-display-xl" : "text-display")}>{remaining}</span>
    </div>
  );
}
