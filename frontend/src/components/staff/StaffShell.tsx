import type { ReactNode } from "react";
import { StaffLogo } from "./StaffLogo";
import { cx } from "@/lib/cx";

type StaffShellProps = {
  /** Right side of the top bar: the account menu, or a «join a game» link on the login screen. */
  topRight?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Room for a side menu and wide tables. */
  wide?: boolean;
};

/** The same top bar on every staff screen: the logo and, on the right, the account menu. */
export function StaffTopBar({ topRight, wide = false }: { topRight?: ReactNode; wide?: boolean }) {
  return (
    <header className="bg-surface-raised">
      <div
        className={cx(
          "mx-auto flex min-h-[64px] w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2",
          wide ? "max-w-[1320px]" : "max-w-[1100px]",
        )}
      >
        <StaffLogo />
        {topRight}
      </div>
    </header>
  );
}

/** Frame of every staff screen: top bar on the raised ground, content below. The theme comes from the layout. */
export function StaffShell({ topRight, children, className, wide = false }: StaffShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <StaffTopBar topRight={topRight} wide={wide} />
      <main
        className={cx(
          "mx-auto flex w-full flex-1 flex-col gap-6 p-4 md:p-6",
          wide ? "max-w-[1320px]" : "max-w-[1100px]",
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}
