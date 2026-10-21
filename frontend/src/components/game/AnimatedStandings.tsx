"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import type { Standing } from "@/types/game";
import { LeaderboardRow } from "./LeaderboardRow";

/** How long the old places stay on screen before anything moves. */
const HOLD_MS = 600;
// Slower than the design system's 150-250ms on purpose: the room watches the scores climb and the
// places change.
const COUNT_MS = 800;
const MOVE_MS = 800;

/** Changes whenever the standings do, as a `key` that plays the animation again. */
export const standingsKey = (rows: readonly Standing[]) => rows.map((row) => `${row.id}:${row.score}`).join();

type Start = { score: number; rank: number };

type AnimatedStandingsProps = {
  /** The rows to show, in their new order. */
  rows: readonly Standing[];
  /** The standings of the round before. Empty after the first question: everyone starts from 0. */
  previous: readonly Standing[];
  badge?: (row: Standing) => ReactNode;
  className?: string;
};

/**
 * A leaderboard that starts on the places of the round before, then counts the scores up while the
 * rows move to their new places. Rows not in `previous` come in from below with their score as is.
 * Remount it (a new `key`) to play it again.
 */
export function AnimatedStandings({ rows, previous, badge, className }: AnimatedStandingsProps) {
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [progress, setProgress] = useState(reduceMotion ? 1 : 0);
  const [moved, setMoved] = useState(reduceMotion);
  const elements = useRef(new Map<string, HTMLLIElement>());
  const tops = useRef(new Map<string, number>());

  const start = new Map<string, Start>();
  for (const row of rows) {
    const before = previous.find((p) => p.id === row.id);
    start.set(
      row.id,
      before ? { score: before.score, rank: before.rank } : { score: previous.length ? row.score : 0, rank: row.rank },
    );
  }
  const known = (row: Standing) => previous.some((p) => p.id === row.id);
  // The old order: the rows that were there by their old rank, then the newcomers.
  const before = [
    ...rows.filter(known).sort((a, b) => (start.get(a.id)?.rank ?? 0) - (start.get(b.id)?.rank ?? 0)),
    ...rows.filter((row) => !known(row)),
  ];

  useEffect(() => {
    if (reduceMotion) return;
    let frame = 0;
    const countUp = window.setTimeout(() => {
      const begin = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - begin) / COUNT_MS);
        setProgress(1 - (1 - p) ** 3); // ease-out: fast at first, settling on the new score
        if (p < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }, HOLD_MS);
    const move = window.setTimeout(() => {
      for (const [id, el] of elements.current) tops.current.set(id, el.getBoundingClientRect().top);
      setMoved(true);
    }, HOLD_MS); // together with the count-up
    return () => {
      window.clearTimeout(countUp);
      window.clearTimeout(move);
      cancelAnimationFrame(frame);
    };
  }, [reduceMotion]);

  // The rows are in their new order now: play each one from where it was.
  useLayoutEffect(() => {
    if (!moved || tops.current.size === 0) return;
    for (const [id, el] of elements.current) {
      const from = tops.current.get(id);
      if (from === undefined) continue;
      const delta = from - el.getBoundingClientRect().top;
      if (delta !== 0) {
        el.animate([{ transform: `translateY(${delta}px)` }, { transform: "none" }], {
          duration: MOVE_MS,
          easing: "ease-in-out",
        });
      }
    }
    tops.current.clear();
  }, [moved]);

  return (
    <ol className={cx("flex flex-col", className)}>
      {(moved ? rows : before).map((row) => {
        const from = start.get(row.id) ?? { score: row.score, rank: row.rank };
        return (
          <li
            key={row.id}
            ref={(el) => {
              if (el) elements.current.set(row.id, el);
              else elements.current.delete(row.id);
            }}
          >
            <LeaderboardRow
              rank={moved ? row.rank : from.rank}
              nickname={row.nickname}
              score={Math.round(from.score + (row.score - from.score) * progress)}
              character={row.character}
              badge={badge?.(row)}
            />
          </li>
        );
      })}
    </ol>
  );
}
