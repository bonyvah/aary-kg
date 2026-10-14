import type { HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "rounded-lg border-2 border-border bg-surface-raised p-6 text-ink",
        "shadow-[0_4px_0_0_var(--border)]",
        className,
      )}
      {...rest}
    />
  );
}
