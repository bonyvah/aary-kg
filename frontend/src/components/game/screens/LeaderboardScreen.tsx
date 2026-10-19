import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import type { PlayerQuestion, Standing } from "@/types/game";
import { AnimatedStandings, standingsKey } from "../AnimatedStandings";
import { PlayerScreen } from "../PlayerScreen";

const TOP_COUNT = 5;

/** Top five, plus the player's own row with its neighbours when they are further down. */
export function visibleStandings(standings: readonly Standing[]): Standing[] {
  const top = standings.slice(0, TOP_COUNT);
  const youIndex = standings.findIndex((row) => row.isYou);
  if (youIndex < TOP_COUNT) return top;
  const around = standings.slice(Math.max(TOP_COUNT, youIndex - 1), youIndex + 2);
  return [...top, ...around];
}

type LeaderboardScreenProps = {
  question: PlayerQuestion;
  standings: readonly Standing[];
  /** The leaderboard before this one: the rows move from those places. */
  previous: readonly Standing[];
  onLeave: () => void;
};

export function LeaderboardScreen({ question, standings, previous, onLeave }: LeaderboardScreenProps) {
  const t = useTranslations("player");

  return (
    <PlayerScreen
      topLeft={<Badge>{t("question.counter", { current: question.index, total: question.total })}</Badge>}
      onLeave={onLeave}
      footer={<p className="text-center text-body text-ink-muted">{t("next")}</p>}
    >
      <h1 className="sr-only">{t("leaderboard.title")}</h1>
      <AnimatedStandings
        key={standingsKey(standings)}
        className="gap-2 pb-1"
        rows={visibleStandings(standings)}
        previous={previous}
        badge={(row) => (row.isYou ? <Badge>{t("leaderboard.you")}</Badge> : undefined)}
      />
    </PlayerScreen>
  );
}
