"use client";

import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import type { Standing } from "@/types/game";
import { Podium } from "./Podium";

type HostPodiumScreenProps = {
  quizId: string;
  standings: readonly Standing[];
};

/** The end of the game: the winners, then the report or back to the dashboard. */
export function HostPodiumScreen({ quizId, standings }: HostPodiumScreenProps) {
  const t = useTranslations("host.live");

  return (
    <div className="flex flex-1 flex-col items-center gap-8">
      <h1 className="text-center text-display font-black sm:text-display-xl">{t("winner")}</h1>
      <Podium className="w-full max-w-[640px]" players={standings.slice(0, 3)} crownLabel={t("crown")} />
      <div className="mt-auto flex flex-wrap justify-center gap-4 pb-4">
        <ButtonLink href={`/reports/${quizId}`} variant="accent" size="lg">
          {t("viewReport")}
        </ButtonLink>
        <ButtonLink href="/dashboard" variant="neutral" size="lg">
          {t("toDashboard")}
        </ButtonLink>
      </div>
    </div>
  );
}
