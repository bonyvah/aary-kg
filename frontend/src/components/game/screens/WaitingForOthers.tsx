"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Spinner } from "@/components/ui/Spinner";

const QUOTES = {
  fast: ["fast1"],
  slow: ["slow1"],
  random: ["random1", "random2", "random3", "random4", "random5", "random6"],
} as const;

// Under a quarter of the time used is fast, over three quarters is slow.
const FAST_SHARE = 0.25;
const SLOW_SHARE = 0.75;
// A fast or slow answer gets its own quote only this often: there are few of them.
const SPECIAL_CHANCE = 0.1;

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function pickQuote(secondsLeft: number, total: number): string {
  const used = total > 0 ? (total - secondsLeft) / total : 0.5;
  const pool = used <= FAST_SHARE ? QUOTES.fast : used >= SLOW_SHARE ? QUOTES.slow : null;
  return pick(pool && Math.random() < SPECIAL_CHANCE ? pool : QUOTES.random);
}

type WaitingForOthersProps = {
  /** Time left at the moment the answer was locked: it is read once, when this mounts. */
  secondsLeft: number;
  total: number;
};

/** Shown instead of the question once the answer is locked. The quote is chosen once and stays. */
export function WaitingForOthers({ secondsLeft, total }: WaitingForOthersProps) {
  const t = useTranslations("player.question");
  const [quote] = useState(() => pickQuote(secondsLeft, total));

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <Spinner label={t("waiting")} size={64} />
      <p className="text-h3 font-bold [overflow-wrap:anywhere]">{t(`quotes.${quote}`)}</p>
    </div>
  );
}
