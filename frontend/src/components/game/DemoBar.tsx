"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

type DemoBarProps<T extends string> = {
  /** Screens the bar can jump to, with their translated names. */
  phases: ReadonlyArray<{ value: T; label: string }>;
  phase: T;
  paused: boolean;
  onPausedChange: (paused: boolean) => void;
  onJump: (phase: T) => void;
  onRestart: () => void;
};

/** Mock phase only (removed when the real connection arrives): pause, jump to any screen, restart. */
export function DemoBar<T extends string>({ phases, phase, paused, onPausedChange, onJump, onRestart }: DemoBarProps<T>) {
  const t = useTranslations("player.dev");

  return (
    <div data-theme="game" className="bg-brand-dark text-ink">
      <div className="mx-auto flex w-full max-w-[480px] flex-wrap items-center gap-2 p-2">
        <Badge variant="accent">{t("label")}</Badge>
        <Select
          hideLabel
          label={t("jump")}
          wrapperClassName="min-w-[140px] flex-1"
          value={phase}
          onChange={(event) => {
            const next = phases.find((item) => item.value === event.target.value);
            if (next) onJump(next.value);
          }}
        >
          {phases.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>
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
