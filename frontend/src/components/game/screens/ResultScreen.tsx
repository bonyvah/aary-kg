"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Check, Cross } from "@/components/icons";
import { useCountUp } from "@/lib/useCountUp";
import { cx } from "@/lib/cx";
import type { PlayerQuestion, RevealPayload } from "@/types/game";
import { AnswerTile, lastTileSpan, type AnswerPosition } from "../AnswerTile";
import { PlayerScreen } from "../PlayerScreen";

const POSITIONS = [
  { position: 1, shape: "red" },
  { position: 2, shape: "blue" },
  { position: 3, shape: "yellow" },
  { position: 4, shape: "green" },
] as const satisfies ReadonlyArray<{ position: AnswerPosition; shape: string }>;

type ResultScreenProps = {
  question: PlayerQuestion;
  /** What the player locked, or null when time ran out. */
  selected: AnswerPosition | null;
  reveal: RevealPayload;
  onLeave: () => void;
};

export function ResultScreen({ question, selected, reveal, onLeave }: ResultScreenProps) {
  const t = useTranslations("player");
  const tc = useTranslations("common");
  const points = useCountUp(reveal.points);
  const isCorrect = selected === reveal.correct;
  const status = selected === null ? "timeUp" : isCorrect ? "correct" : "wrong";
  const texts = question.answers;

  return (
    <PlayerScreen
      topLeft={<Badge>{t("question.counter", { current: question.index, total: question.total })}</Badge>}
      onLeave={onLeave}
      footer={<p className="text-center text-body text-ink-muted">{t("next")}</p>}
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-display font-black tabular-nums">{t("result.points", { points })}</h1>
        <p
          className={cx(
            "flex items-center gap-2 text-h3 font-black",
            isCorrect ? "text-success-text" : "text-danger-text",
          )}
        >
          {isCorrect ? <Check width={24} height={24} /> : <Cross width={24} height={24} />}
          {t(`result.${status}`)}
        </p>
      </div>
      <div className={cx("mt-auto grid gap-4 pb-2", texts ? "grid-cols-1" : "grid-cols-2")}>
        {POSITIONS.filter(({ position }) => question.positions.includes(position)).map(({ position, shape }, index, shown) => {
          const mark =
            position === reveal.correct
              ? ({ result: "ok", resultLabel: t("result.correct") } as const)
              : position === selected
                ? ({ result: "no", resultLabel: t("result.wrong") } as const)
                : ({ dim: true } as const);
          if (texts) {
            return (
              <AnswerTile key={position} position={position} {...mark}>
                {texts[position - 1]}
              </AnswerTile>
            );
          }
          return (
            <AnswerTile
              key={position}
              shapeOnly
              position={position}
              className={lastTileSpan(index, shown.length)}
              aria-label={tc(`answerShape.${shape}`)}
              {...mark}
            />
          );
        })}
      </div>
    </PlayerScreen>
  );
}
