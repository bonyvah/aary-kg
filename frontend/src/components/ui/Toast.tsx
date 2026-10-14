import type { ReactNode } from "react";
import { Check, Cross } from "@/components/icons";
import { cx } from "@/lib/cx";

export type ToastVariant = "neutral" | "success" | "danger";

type ToastProps = {
  variant?: ToastVariant;
  /** Translated message. Always words, never color alone. */
  children: ReactNode;
  /** Optional dismiss control, e.g. an icon Button with a translated aria-label. */
  action?: ReactNode;
  className?: string;
};

const variants: Record<ToastVariant, string> = {
  neutral: "border-2 border-border bg-surface-raised text-ink shadow-[0_4px_0_0_var(--border)]",
  success: "bg-success text-on-success shadow-[0_4px_0_0_var(--success-edge)]",
  danger: "bg-danger text-on-danger shadow-[0_4px_0_0_var(--danger-edge)]",
};

export function Toast({ variant = "neutral", children, action, className }: ToastProps) {
  return (
    <div
      role={variant === "danger" ? "alert" : "status"}
      className={cx(
        "flex min-h-[44px] items-center gap-3 rounded-md px-4 py-3 text-body-lg font-bold",
        variants[variant],
        className,
      )}
    >
      {variant === "success" ? <Check width={24} height={24} className="flex-none" /> : null}
      {variant === "danger" ? <Cross width={24} height={24} className="flex-none" /> : null}
      <p className="min-w-0 flex-1 [overflow-wrap:anywhere]">{children}</p>
      {action}
    </div>
  );
}

/** Fixed stack for toasts: bottom of the screen, above everything. */
export function ToastRegion({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-[480px] flex-col gap-2 *:pointer-events-auto">
      {children}
    </div>
  );
}
