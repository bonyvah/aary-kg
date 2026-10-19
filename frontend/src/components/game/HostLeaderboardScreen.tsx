"use client";

import { useTranslations } from "next-intl";
import type { Standing } from "@/types/game";
import { HostQuestionHeader } from "./HostQuestionScreen";
import { AnimatedStandings, standingsKey } from "./AnimatedStandings";

const TOP_COUNT = 5;

type HostLeaderboardScreenProps = {
  round: number;
  totalQuestions: number;
  standings: readonly Standing[];
  /** The leaderboard before this one: the rows move from those places. */
  previous: readonly Standing[];
};

/** The top five after a question, big enough for a projector. */
export function HostLeaderboardScreen({ round, totalQuestions, standings, previous }: HostLeaderboardScreenProps) {
  const t = useTranslations("host.live");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <HostQuestionHeader round={round} totalQuestions={totalQuestions} />
      <h1 className="text-display font-black">{t("leaderboard")}</h1>
      <AnimatedStandings
        key={standingsKey(standings)}
        className="mx-auto w-full max-w-[760px] gap-3 pb-2"
        rows={standings.slice(0, TOP_COUNT)}
        previous={previous}
      />
    </div>
  );
}
