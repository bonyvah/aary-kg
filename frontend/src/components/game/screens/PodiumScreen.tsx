import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import type { Standing } from "@/types/game";
import { PlayerScreen } from "../PlayerScreen";
import { Podium } from "../Podium";

type PodiumScreenProps = {
  standings: readonly Standing[];
  onExit: () => void;
};

export function PodiumScreen({ standings, onExit }: PodiumScreenProps) {
  const t = useTranslations("player.podium");
  const you = standings.find((row) => row.isYou);

  return (
    <PlayerScreen
      footer={
        <Button block size="lg" variant="neutral" onClick={onExit}>
          {t("exit")}
        </Button>
      }
    >
      <h1 className="text-center text-display font-black">{t("title")}</h1>
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <Podium className="w-full" players={standings.slice(0, 3)} crownLabel={t("crown")} />
        {you ? <p className="text-center text-body-lg font-bold">{t("yourPlace", { rank: you.rank, score: you.score })}</p> : null}
      </div>
    </PlayerScreen>
  );
}
