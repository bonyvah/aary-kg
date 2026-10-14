import { useTranslations } from "next-intl";
import { Crown } from "@/components/icons";
import { cx } from "@/lib/cx";
import type { RankedEntry } from "@/types/contest";

// Block height and color follow the rank, as on the player podium: 1st 160, 2nd 112, 3rd 80.
const steps = [
  { block: "h-[160px] bg-accent text-on-accent" },
  { block: "h-[112px] bg-tile-blue text-on-tile" },
  { block: "h-[80px] bg-warning text-on-warning" },
] as const;

type ResultsPodiumProps = {
  /** The first three ranked entries, best first. */
  top: readonly RankedEntry[];
  formatScore: (score: number) => string;
};

/** The top three entries. Equal scores share a rank, so two blocks can have the same height and number. */
export function ResultsPodium({ top, formatScore }: ResultsPodiumProps) {
  const t = useTranslations("contest.results");
  // Left to right: second, first, third.
  const columns = [top[1], top[0], top[2]].filter((item): item is RankedEntry => item !== undefined);

  return (
    <div className="flex items-end justify-center gap-3 sm:gap-4">
      {columns.map((item) => {
        const rank = item.rank ?? 3;
        const step = steps[Math.min(rank, 3) - 1] ?? steps[2];
        return (
          <div key={item.entry.id} className="flex min-w-0 max-w-[200px] flex-1 flex-col items-center gap-2 text-center">
            {rank === 1 ? <Crown aria-label={t("crown")} className="size-10 text-accent" /> : null}
            <span className="max-w-full break-words text-body-lg font-black">{item.entry.name}</span>
            <span className="text-body font-bold text-ink-muted tabular-nums">
              {item.finalScore === null ? "—" : formatScore(item.finalScore)}
            </span>
            <div className={cx("flex w-full justify-center rounded-t-md pt-3 text-display font-black", step.block)}>{rank}</div>
          </div>
        );
      })}
    </div>
  );
}
