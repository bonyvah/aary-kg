import type { ReactNode } from "react";
import { useFormatter } from "next-intl";
import { cx } from "@/lib/cx";
import { Avatar } from "./Avatar";
import type { Character } from "./avatar/characters";

type LeaderboardRowProps = {
  rank: number;
  /** Typed by the player: truncates with an ellipsis, full name in the title. */
  nickname: string;
  score: number;
  character: Character;
  /** Small marker after the nickname, e.g. a «you» badge on the player's own row. */
  badge?: ReactNode;
  className?: string;
};

export function LeaderboardRow({ rank, nickname, score, character, badge, className }: LeaderboardRowProps) {
  const format = useFormatter();
  const first = rank === 1;

  return (
    <div
      className={cx(
        "flex min-h-[56px] items-center gap-4 rounded-md px-4 py-2",
        first
          ? "bg-accent text-on-accent shadow-[0_4px_0_0_var(--accent-edge)]"
          : "bg-field text-on-field shadow-[0_4px_0_0_var(--border)]",
        className,
      )}
    >
      <span className="min-w-8 text-center text-h3 font-black">{format.number(rank)}</span>
      <Avatar character={character} />
      <span title={nickname} className="min-w-0 flex-1 truncate text-body-lg font-bold">
        {nickname}
      </span>
      {badge}
      <span className="text-body-lg font-black tabular-nums">{format.number(score)}</span>
    </div>
  );
}
