import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/cx";

type IconLinkProps = Omit<ComponentProps<typeof Link>, "children" | "aria-label"> & {
  /** Translated name: an icon alone says nothing to assistive tech. */
  label: string;
  children: ReactNode;
};

/** The IconButton look for navigation: a real link with a 44px target. */
export function IconLink({ label, className, children, ...rest }: IconLinkProps) {
  return (
    <Link
      aria-label={label}
      className={cx(
        "grid min-h-[44px] min-w-[44px] place-items-center rounded-md text-ink",
        "transition-colors duration-150 ease-out hover:bg-surface active:bg-brand-dark",
        "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
        className,
      )}
      {...rest}
    >
      {children}
    </Link>
  );
}
