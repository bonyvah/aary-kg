"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * A tab that is remembered in this browser, so coming back to the screen opens the last one.
 * Storage can be blocked or empty: then the first tab is used.
 */
export function useStoredTab<T extends string>(key: string, tabs: readonly T[], fallback: T): [T, (tab: T) => void] {
  const [tab, setTab] = useState<T>(fallback);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key);
      if (saved && (tabs as readonly string[]).includes(saved)) setTab(saved as T);
    } catch {
      // Storage blocked: stay on the first tab.
    }
    // The tab list is a constant of the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const choose = useCallback(
    (next: T) => {
      setTab(next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Storage blocked: the choice still works for this visit.
      }
    },
    [key],
  );

  return [tab, choose];
}
