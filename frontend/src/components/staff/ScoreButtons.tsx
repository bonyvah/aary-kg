"use client";

import type { KeyboardEvent } from "react";
import { cx } from "@/lib/cx";
import { SCORES } from "@/lib/contestScoring";
import type { Score } from "@/types/contest";

type ScoreButtonsProps = {
  /** Translated name of the group: the criterion and its weight. */
  label: string;
  value: Score | undefined;
  onChange: (score: Score) => void;
};

/** Five big buttons, 1 to 5, one chosen. A radio group: arrow keys move the choice. */
export function ScoreButtons({ label, value, onChange }: ScoreButtonsProps) {
  function onKeyDown(event: KeyboardEvent, score: Score) {
    const step = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = SCORES[Math.min(SCORES.length - 1, Math.max(0, score - 1 + step))];
    if (next === undefined) return;
    onChange(next);
    (event.currentTarget.parentElement?.children[next - 1] as HTMLElement | undefined)?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-2">
      {SCORES.map((score) => {
        const selected = value === score;
        return (
          <button
            key={score}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (value === undefined && score === 1) ? 0 : -1}
            onClick={() => onChange(score)}
            onKeyDown={(event) => onKeyDown(event, score)}
            className={cx(
              "grid min-h-[56px] place-items-center rounded-md text-h2 font-black tabular-nums",
              "cursor-pointer transition-[transform,box-shadow] duration-150 ease-out",
              "hover:-translate-y-px active:translate-y-1",
              "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
              selected
                ? "bg-accent text-on-accent shadow-edge-accent"
                : "bg-surface-raised text-ink shadow-[0_4px_0_0_var(--border)]",
            )}
          >
            {score}
          </button>
        );
      })}
    </div>
  );
}
