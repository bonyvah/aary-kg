import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> & {
  /** Translated name: an icon alone says nothing to assistive tech. */
  label: string;
  children: ReactNode;
};

/** Flat icon-only button for toolbars: a 44px target, a tint on hover and press, a focus ring. */
export function IconButton({ label, className, type = "button", children, ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cx(
        "grid min-h-[44px] min-w-[44px] place-items-center rounded-md text-ink",
        "cursor-pointer transition-colors duration-150 ease-out hover:bg-surface active:bg-brand-dark",
        "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
        "disabled:cursor-not-allowed disabled:text-on-disabled disabled:hover:bg-transparent",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
