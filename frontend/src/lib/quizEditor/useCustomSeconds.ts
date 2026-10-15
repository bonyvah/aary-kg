"use client";

import { useCallback, useEffect, useState } from "react";
import { MAX_SECONDS, MIN_SECONDS, SECONDS_OPTIONS } from "./reducer";

const STORAGE_KEY = "aary.customSecondsUsage";
/** How many typed-in times the dropdown offers besides the presets. */
const MAX_LISTED = 7;

type Usage = Record<string, number>;

const isCustom = (seconds: number) => !(SECONDS_OPTIONS as readonly number[]).includes(seconds);

function read(): Usage {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (typeof parsed !== "object" || parsed === null) return {};
    const usage: Usage = {};
    for (const [key, count] of Object.entries(parsed)) {
      const seconds = Number(key);
      if (Number.isInteger(seconds) && seconds >= MIN_SECONDS && seconds <= MAX_SECONDS && Number.isInteger(count) && count > 0) {
        usage[key] = count;
      }
    }
    return usage;
  } catch {
    return {};
  }
}

/**
 * Answer times typed in by the user, ranked by how many questions use them (counted in this browser).
 * A time nobody uses any more drops out; only the most used few are offered.
 */
export function useCustomSeconds() {
  const [usage, setUsage] = useState<Usage>({});

  useEffect(() => {
    setUsage(read());
  }, []);

  /** A question changes from one time to another. */
  const move = useCallback((from: number, to: number) => {
    if (from === to) return;
    const next = read();
    if (isCustom(from) && next[from]) {
      next[from] -= 1;
      if (next[from] <= 0) delete next[from];
    }
    if (isCustom(to)) next[to] = (next[to] ?? 0) + 1;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage can be blocked; the choice still works for this page.
    }
    setUsage(next);
  }, []);

  const popular = Object.entries(usage)
    .sort(([a, countA], [b, countB]) => countB - countA || Number(a) - Number(b))
    .slice(0, MAX_LISTED)
    .map(([seconds]) => Number(seconds));

  return { popular, move };
}
