"use client";

import { useEffect, useState } from "react";
import type { Player } from "@/types/game";

/** Stands in for the «player joined» events of the lobby socket: one more player every `intervalMs`. */
export function useMockJoiners(all: readonly Player[], intervalMs: number, paused = false): readonly Player[] {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (paused || count >= all.length) return;
    const timer = setTimeout(() => setCount((current) => current + 1), intervalMs);
    return () => clearTimeout(timer);
  }, [paused, count, all.length, intervalMs]);

  return all.slice(0, count);
}
