"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { GamePhase } from "@/types/game";

const PHASES: readonly GamePhase[] = [
  "join",
  "nickname",
  "lobby",
  "character",
  "question",
  "answered",
  "result",
  "leaderboard",
  "podium",
];

type DemoBarProps = {
  phase: GamePhase;
  paused: boolean;
  onPausedChange: (paused: boolean) => void;
  onJump: (phase: GamePhase) => void;
  onRestart: () => void;
};

/** Mock phase only (removed when the real connection arrives): pause, jump to any screen, restart. */
export function DemoBar({ phase, paused, onPausedChange, onJump, onRestart }: DemoBarProps) {
  const t = useTranslations("player.dev");

  return (
    <div data-theme="game" className="bg-brand-dark text-ink">
      <div className="mx-auto flex w-full max-w-[480px] flex-wrap items-center gap-2 p-2">
        <Badge variant="accent">{t("label")}</Badge>
        <select
          aria-label={t("jump")}
          value={phase}
          onChange={(event) => onJump(event.target.value as GamePhase)}
          className="min-h-[44px] min-w-[140px] flex-1 rounded-md border-2 border-field-border bg-field px-3 text-body font-bold text-on-field focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          {PHASES.map((value) => (
            <option key={value} value={value}>
              {t(`phase.${value}`)}
            </option>
          ))}
        </select>
        <Button variant="neutral" aria-pressed={paused} onClick={() => onPausedChange(!paused)}>
          {paused ? t("resume") : t("pause")}
        </Button>
        <Button variant="neutral" onClick={onRestart}>
          {t("restart")}
        </Button>
      </div>
    </div>
  );
}
