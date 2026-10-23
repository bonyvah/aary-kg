"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

/** Covers the player's screen while they are in a game but not in full screen. */
export function FullscreenGate({
  onEnter,
  namespace = "player.fullscreen",
}: {
  onEnter: () => void;
  /** The texts: a game's, or an exam's. */
  namespace?: "player.fullscreen" | "student.exam.fullscreen";
}) {
  const t = useTranslations(namespace);
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="fullscreen-gate-title"
      data-theme="game"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-surface p-6 text-center text-ink"
    >
      <h1 id="fullscreen-gate-title" className="text-display font-black [overflow-wrap:anywhere]">
        {t("title")}
      </h1>
      <p className="max-w-[360px] text-body-lg">{t("body")}</p>
      <Button size="lg" onClick={onEnter}>
        {t("enter")}
      </Button>
    </div>
  );
}
