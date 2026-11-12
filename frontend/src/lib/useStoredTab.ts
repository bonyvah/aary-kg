"use client";

import { useCallback, useEffect, useState } from "react";

const PARAM = "tab";

function urlTab<T extends string>(tabs: readonly T[]): T | null {
  const value = new URLSearchParams(window.location.search).get(PARAM);
  return value && (tabs as readonly string[]).includes(value) ? (value as T) : null;
}

/**
 * The open tab, kept in the address (`?tab=groups`) so it can be linked and the back button works.
 * Without it in the address, the last one used in this browser opens; storage can be blocked or empty:
 * then the fallback is used.
 */
export function useStoredTab<T extends string>(key: string, tabs: readonly T[], fallback: T): [T, (tab: T) => void] {
  const [tab, setTab] = useState<T>(fallback);

  useEffect(() => {
    const fromUrl = urlTab(tabs);
    if (fromUrl) {
      setTab(fromUrl);
      return;
    }
    try {
      const saved = window.localStorage.getItem(key);
      if (saved && (tabs as readonly string[]).includes(saved)) setTab(saved as T);
    } catch {
      // Storage blocked: stay on the first tab.
    }
    // The tab list is a constant of the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Back and forward move between the tabs that were opened.
  useEffect(() => {
    const onPop = () => setTab(urlTab(tabs) ?? fallback);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const choose = useCallback(
    (next: T) => {
      setTab(next);
      const url = new URL(window.location.href);
      url.searchParams.set(PARAM, next);
      window.history.pushState(null, "", url);
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
