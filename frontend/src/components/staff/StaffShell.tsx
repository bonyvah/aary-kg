import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";
import { cx } from "@/lib/cx";

type StaffShellProps = {
  /** Right side of the top bar: the account menu, or a «join a game» link on the login screen. */
  topRight?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Frame of every staff screen: top bar on the raised ground, content below. The theme comes from the layout. */
export function StaffShell({ topRight, children, className }: StaffShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-surface-raised">
        <div className="mx-auto flex min-h-[64px] w-full max-w-[1100px] items-center justify-between gap-4 px-4 py-2">
          <Logo />
          {topRight}
        </div>
      </header>
      <main className={cx("mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-6 p-4 md:p-6", className)}>
        {children}
      </main>
    </div>
  );
}
