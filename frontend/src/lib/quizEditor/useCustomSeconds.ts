"use client";

import { useCallback, useEffect, useState } from "react";
import { MAX_SECONDS, MIN_SECONDS } from "./reducer";

const STORAGE_KEY = "aary.customSeconds";

function read(): number[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n): n is number => Number.isInteger(n) && n >= MIN_SECONDS && n <= MAX_SECONDS);
  } catch {
    return [];
  }
}

/** Answer times the user typed in earlier, kept in this browser so every quiz offers them. */
export function useCustomSeconds() {
  const [values, setValues] = useState<number[]>([]);

  useEffect(() => {
    setValues(read());
  }, []);

  const add = useCallback((seconds: number) => {
    const next = Array.from(new Set([...read(), seconds]));
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage can be blocked; the value still works for this page.
    }
    setValues(next);
  }, []);

  return { values, add };
}
