import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Logo } from "@/components/ui/Logo";
import { PlayerSettings } from "./PlayerSettings";

type PlayerScreenProps = {
  /** Given while the player is in a game: the settings then offer «leave game». */
  onLeave?: () => void;
  /** Left side of the top bar. The logo when left out. */
  topLeft?: ReactNode;
  /** Pinned to the bottom, e.g. the main button. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Portrait phone shell for every player screen: game theme, top bar with the settings gear, content, bottom area. */
export function PlayerScreen({ topLeft, onLeave, footer, children, className }: PlayerScreenProps) {
  return (
    <div data-theme="game" className="min-h-dvh bg-surface text-ink">
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-6 p-4">
        <header className="flex min-h-[44px] flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {topLeft ?? <Logo />}
          <PlayerSettings onLeave={onLeave} />
        </header>
        <main className={cx("flex flex-1 flex-col gap-6", className)}>{children}</main>
        {footer ? <footer>{footer}</footer> : null}
      </div>
    </div>
  );
}
