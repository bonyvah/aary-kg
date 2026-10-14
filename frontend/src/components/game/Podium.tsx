import { useFormatter } from "next-intl";
import { Crown } from "@/components/icons";
import { cx } from "@/lib/cx";
import { Avatar, type AvatarId } from "./Avatar";

export type PodiumPlayer = { nickname: string; score: number; avatar: AvatarId };

type PodiumProps = {
  /** Top players in rank order: 1st, 2nd, 3rd. Fewer than three leaves steps out. */
  players: readonly PodiumPlayer[];
  /** Translated aria-label for the crown. */
  crownLabel: string;
  className?: string;
};

const steps = {
  1: { block: "h-40 bg-accent text-on-accent", delay: "[animation-delay:400ms]" },
  2: { block: "h-28 bg-tile-blue text-on-tile", delay: "[animation-delay:200ms]" },
  3: { block: "h-20 bg-warning text-on-warning", delay: "[animation-delay:0ms]" },
} as const;

type Rank = keyof typeof steps;

export function Podium({ players, crownLabel, className }: PodiumProps) {
  const format = useFormatter();
  const [first, second, third] = players;
  // Left to right: 2nd, 1st, 3rd.
  const columns: Array<{ rank: Rank; player: PodiumPlayer }> = [];
  if (second) columns.push({ rank: 2, player: second });
  if (first) columns.push({ rank: 1, player: first });
  if (third) columns.push({ rank: 3, player: third });

  return (
    <div className={cx("flex items-end justify-center gap-4 text-ink", className)}>
      {columns.map(({ rank, player }) => (
        <div
          key={rank}
          className={cx(
            "flex w-28 flex-col items-center gap-2 text-center animate-reveal",
            steps[rank].delay,
          )}
        >
          {rank === 1 ? <Crown aria-label={crownLabel} className="size-10 text-accent" /> : null}
          <Avatar avatar={player.avatar} size="lg" />
          <span title={player.nickname} className="max-w-full truncate text-body-lg font-black">
            {player.nickname}
          </span>
          <span className="text-body font-bold text-ink-muted tabular-nums">
            {format.number(player.score)}
          </span>
          <div
            className={cx(
              "flex w-full justify-center rounded-t-md pt-3 text-display font-black",
              steps[rank].block,
            )}
          >
            {format.number(rank)}
          </div>
        </div>
      ))}
    </div>
  );
}
