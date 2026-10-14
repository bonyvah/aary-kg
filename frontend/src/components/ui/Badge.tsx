import type { HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

export type BadgeVariant = "brand" | "accent" | "success" | "danger" | "neutral";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant };

const variants: Record<BadgeVariant, string> = {
  brand: "bg-brand text-on-brand",
  accent: "bg-accent text-on-accent",
  success: "bg-success text-on-success",
  danger: "bg-danger text-on-danger",
  neutral: "bg-border text-ink",
};

export function Badge({ variant = "brand", className, ...rest }: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-caption font-bold",
        variants[variant],
        className,
      )}
      {...rest}
    />
  );
}
