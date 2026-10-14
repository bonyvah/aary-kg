import { cx } from "@/lib/cx";
import { Avatar, type AvatarId } from "./Avatar";

type LobbyChipProps = {
  nickname: string;
  avatar: AvatarId;
  /** Pop-in for the host's lobby wall. */
  animate?: boolean;
  className?: string;
};

/** One joined player: avatar plus nickname on a white pill. */
export function LobbyChip({ nickname, avatar, animate = false, className }: LobbyChipProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full bg-field py-1 pr-4 pl-1 text-body-lg font-bold text-on-field",
        "shadow-[0_4px_0_0_var(--border)]",
        animate && "animate-pop",
        className,
      )}
    >
      <Avatar avatar={avatar} />
      <span className="min-w-0 [overflow-wrap:anywhere]">{nickname}</span>
    </span>
  );
}
