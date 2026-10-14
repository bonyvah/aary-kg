"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Toast, ToastRegion, type ToastVariant } from "./Toast";

const VISIBLE_MS = 3000;

/** One toast at a time that hides itself. Render `toast` once in the screen and call `show`. */
export function useToast(): { toast: ReactNode; show: (variant: ToastVariant, message: string) => void } {
  const [current, setCurrent] = useState<{ variant: ToastVariant; message: string; id: number } | null>(null);

  const show = useCallback((variant: ToastVariant, message: string) => {
    setCurrent((previous) => ({ variant, message, id: (previous?.id ?? 0) + 1 }));
  }, []);

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => setCurrent(null), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [current]);

  const toast = current ? (
    <ToastRegion>
      <Toast variant={current.variant}>{current.message}</Toast>
    </ToastRegion>
  ) : null;

  return { toast, show };
}
