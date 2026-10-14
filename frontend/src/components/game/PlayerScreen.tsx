import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cx } from "@/lib/cx";

export function Logo({ className }: { className?: string }) {
  const t = useTranslations("app");
  return <span className={cx("text-h3 font-black lowercase text-ink", className)}>{t("name")}</span>;
}

type PlayerScreenProps = {
  /** Right side of the top bar, e.g. a badge. */
  topRight?: ReactNode;
  /** Left side of the top bar. The logo when left out. */
  topLeft?: ReactNode;
  /** Pinned to the bottom, e.g. the main button. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Portrait phone shell for every player screen: game theme, top bar, content, bottom area. */
export function PlayerScreen({ topLeft, topRight, footer, children, className }: PlayerScreenProps) {
  return (
    <div data-theme="game" className="min-h-dvh bg-surface text-ink">
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-6 p-4">
        <header className="flex min-h-[44px] items-center justify-between gap-4">
          {topLeft ?? <Logo />}
          {topRight}
        </header>
        <main className={cx("flex flex-1 flex-col gap-6", className)}>{children}</main>
        {footer ? <footer>{footer}</footer> : null}
      </div>
    </div>
  );
}
