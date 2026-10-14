"use client";

import { useTranslations } from "next-intl";
import type { Standing } from "@/types/game";
import { HostQuestionHeader } from "./HostQuestionScreen";
import { LeaderboardRow } from "./LeaderboardRow";

const TOP_COUNT = 5;

type HostLeaderboardScreenProps = {
  round: number;
  totalQuestions: number;
  standings: readonly Standing[];
};

/** The top five after a question, big enough for a projector. */
export function HostLeaderboardScreen({ round, totalQuestions, standings }: HostLeaderboardScreenProps) {
  const t = useTranslations("host.live");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <HostQuestionHeader round={round} totalQuestions={totalQuestions} />
      <h1 className="text-display font-black">{t("leaderboard")}</h1>
      <ol className="mx-auto flex w-full max-w-[760px] flex-col gap-3 pb-2">
        {standings.slice(0, TOP_COUNT).map((row) => (
          <li key={row.id}>
            <LeaderboardRow rank={row.rank} nickname={row.nickname} score={row.score} character={row.character} />
          </li>
        ))}
      </ol>
    </div>
  );
}
