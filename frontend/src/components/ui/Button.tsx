import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

export type ButtonVariant = "primary" | "accent" | "success" | "danger" | "neutral" | "secondary";
export type ButtonSize = "default" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary shadow-edge-primary [--edge-c:var(--primary-edge)]",
  accent: "bg-accent text-on-accent shadow-edge-accent [--edge-c:var(--accent-edge)]",
  success: "bg-success text-on-success shadow-edge-success [--edge-c:var(--success-edge)]",
  danger: "bg-danger text-on-danger shadow-edge-danger [--edge-c:var(--danger-edge)]",
  secondary: "bg-tile-blue text-on-tile shadow-[0_4px_0_0_var(--tile-blue-edge)] [--edge-c:var(--tile-blue-edge)]",
  neutral: "bg-surface-raised text-ink shadow-edge-neutral [--edge-c:var(--border-control)]",
};

const sizes: Record<ButtonSize, string> = {
  default: "min-h-[44px] px-6 py-3 text-body-lg font-bold",
  lg: "min-h-[56px] px-8 py-4 text-h3 font-black",
};

type ButtonLook = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
};

/** The look of a button, shared by `Button` and `ButtonLink`. */
export function buttonClasses({ variant = "primary", size = "default", block = false, className }: ButtonLook) {
  return cx(
    "items-center justify-center gap-2 rounded-md text-center",
    "cursor-pointer transition-[transform,box-shadow] duration-150 ease-out",
    "hover:-translate-y-px hover:shadow-[0_5px_0_0_var(--edge-c)]",
    "active:translate-y-1 active:shadow-[0_0_0_0_var(--edge-c)]",
    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
    "disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-disabled disabled:text-on-disabled",
    "disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:active:translate-y-0",
    block ? "flex w-full" : "inline-flex",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "default",
  block = false,
  type = "button",
  className,
  ...rest
}: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size, block, className })} {...rest} />;
}
