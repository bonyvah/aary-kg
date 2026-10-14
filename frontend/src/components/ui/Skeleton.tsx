import { cx } from "@/lib/cx";

/** Flat placeholder block. Give it the size of the content it stands in for. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx("animate-pulse rounded-md bg-border motion-reduce:animate-none", className)}
    />
  );
}
