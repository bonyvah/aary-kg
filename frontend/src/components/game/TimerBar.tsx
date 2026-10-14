import type { CSSProperties } from "react";
import { cx } from "@/lib/cx";

type TimerBarProps = {
  /** Seconds left, from the server's clock. */
  remaining: number;
  total: number;
  /** Translated unit, e.g. «сек». */
  unit: string;
  className?: string;
};

const URGENT_SECONDS = 5;

/** Only draws what the server says. It never decides when answers close. */
export function TimerBar({ remaining, total, unit, className }: TimerBarProps) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (remaining / total) * 100)) : 0;
  const urgent = remaining <= URGENT_SECONDS;
  // The fill width is a runtime value, so it travels as a CSS variable (as in the design system preview).
  const fillVars = { "--pct": `${pct}%` } as CSSProperties;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={remaining}
      aria-valuetext={`${remaining} ${unit}`}
      className={cx("flex items-center gap-4 text-ink", className)}
    >
      <div className="h-4 flex-1 overflow-hidden rounded-full bg-surface-raised motion-reduce:hidden">
        <div
          style={fillVars}
          className={cx(
            "h-full w-(--pct) rounded-full transition-[width] duration-1000 ease-linear",
            urgent ? "bg-danger" : "bg-accent",
          )}
        />
      </div>
      <span className="min-w-12 text-right text-h2 font-black tabular-nums">{remaining}</span>
      <span className="text-body font-bold text-ink-muted">{unit}</span>
    </div>
  );
}
