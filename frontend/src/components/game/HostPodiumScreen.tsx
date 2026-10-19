"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import type { Standing } from "@/types/game";
import { NextGameModal } from "./NextGameModal";
import { Podium } from "./Podium";

type HostPodiumScreenProps = {
  gameId: string;
  standings: readonly Standing[];
  /** Another quiz with the players still connected. */
  onNextGame: (quizId: string) => Promise<void>;
};

/** The end of the game: the winners, then another game with the same players, the report, or the dashboard. */
export function HostPodiumScreen({ gameId, standings, onNextGame }: HostPodiumScreenProps) {
  const t = useTranslations("host.live");
  const [picking, setPicking] = useState(false);

  return (
    <div className="flex flex-1 flex-col items-center gap-8">
      <h1 className="text-center text-display font-black sm:text-display-xl">{t("winner")}</h1>
      <Podium className="w-full max-w-[640px]" players={standings.slice(0, 3)} crownLabel={t("crown")} />
      <div className="mt-auto flex flex-wrap justify-center gap-4 pb-4">
        <Button variant="accent" size="lg" onClick={() => setPicking(true)}>
          {t("nextGame")}
        </Button>
        <ButtonLink href={`/reports/${gameId}`} variant="secondary" size="lg">
          {t("viewReport")}
        </ButtonLink>
        <ButtonLink href="/dashboard" variant="neutral" size="lg">
          {t("toDashboard")}
        </ButtonLink>
      </div>
      <NextGameModal open={picking} onClose={() => setPicking(false)} onPick={onNextGame} />
    </div>
  );
}
