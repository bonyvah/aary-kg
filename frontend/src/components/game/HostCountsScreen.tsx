"use client";

import type { CSSProperties } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { cx } from "@/lib/cx";
import type { QuizQuestion } from "@/types/quiz";
import { AnswerTile, type AnswerPosition } from "./AnswerTile";
import { HostQuestionHeader, POSITIONS } from "./HostQuestionScreen";

const BAR_COLOR: Record<AnswerPosition, string> = {
  1: "bg-tile-red",
  2: "bg-tile-blue",
  3: "bg-tile-yellow",
  4: "bg-tile-green",
};

type HostCountsScreenProps = {
  question: QuizQuestion;
  round: number;
  totalQuestions: number;
  counts: readonly [number, number, number, number];
};

/** After the question closed: the right answer keeps its color with a check, the rest are dimmed, each with its count. */
export function HostCountsScreen({ question, round, totalQuestions, counts }: HostCountsScreenProps) {
  const t = useTranslations("host.live");
  const format = useFormatter();
  const most = Math.max(1, ...counts);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <HostQuestionHeader round={round} totalQuestions={totalQuestions} />
      <h1 className="text-display font-black [overflow-wrap:anywhere]">{question.text}</h1>
      <div className="grid grid-cols-1 gap-x-4 gap-y-6 pb-2 sm:grid-cols-2">
        {POSITIONS.map((position) => {
          const right = position === question.correct;
          const count = counts[position - 1] ?? 0;
          const barVars = { "--pct": `${(count / most) * 100}%` } as CSSProperties;
          return (
            <div key={position} className="flex flex-col gap-3">
              <AnswerTile
                position={position}
                dim={!right}
                disabled
                result={right ? "ok" : undefined}
                resultLabel={t("correct")}
                className="pointer-events-none"
              >
                {question.answers[position - 1]}
              </AnswerTile>
              <div className="flex items-center gap-3">
                <div className="h-4 flex-1 overflow-hidden rounded-full bg-surface-raised">
                  <div
                    style={barVars}
                    className={cx(
                      "h-full w-(--pct) rounded-full transition-[width] duration-200 ease-out motion-reduce:transition-none",
                      right ? BAR_COLOR[position] : "bg-disabled",
                    )}
                  />
                </div>
                <p className="min-w-[88px] text-right text-body font-bold tabular-nums">
                  {t("count", { count: count, formatted: format.number(count) })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
