import { useEffect, useState } from "react";

/** «29:41», or «1:02:05» past an hour. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/**
 * Seconds left, counted down from what the server said. Uses the browser's monotonic clock, so moving
 * the device's time doesn't change it. The server decides when the attempt ends; this only shows it.
 */
export function useCountdown(secondsLeft: number, key: unknown): number {
  const [left, setLeft] = useState(secondsLeft);
  useEffect(() => {
    const from = performance.now();
    setLeft(secondsLeft);
    const timer = setInterval(() => {
      setLeft(Math.max(0, secondsLeft - Math.floor((performance.now() - from) / 1000)));
    }, 250);
    return () => clearInterval(timer);
  }, [secondsLeft, key]);
  return left;
}

/** The answer positions a question uses: the ones with text. */
export function usedPositions(answers: readonly string[]): (1 | 2 | 3 | 4)[] {
  return ([1, 2, 3, 4] as const).filter((p) => (answers[p - 1] ?? "").trim() !== "");
}
