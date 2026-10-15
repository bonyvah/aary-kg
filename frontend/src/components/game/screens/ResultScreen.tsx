"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Check, Cross } from "@/components/icons";
import { useCountUp } from "@/lib/useCountUp";
import { cx } from "@/lib/cx";
import type { PlayerQuestion, RevealPayload } from "@/types/game";
import { AnswerTile, type AnswerPosition } from "../AnswerTile";
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
      <div className="mt-auto grid grid-cols-2 gap-4 pb-2">
        {POSITIONS.map(({ position, shape }) => {
          const common = { shapeOnly: true, position, "aria-label": tc(`answerShape.${shape}`) } as const;
          if (position === reveal.correct) {
            return <AnswerTile key={position} {...common} result="ok" resultLabel={t("result.correct")} />;
          }
          if (position === selected) {
            return <AnswerTile key={position} {...common} result="no" resultLabel={t("result.wrong")} />;
          }
          return <AnswerTile key={position} {...common} dim />;
        })}
      </div>
    </PlayerScreen>
  );
}
