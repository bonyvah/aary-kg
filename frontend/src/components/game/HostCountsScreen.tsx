"use client";

import type { CSSProperties } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { cx } from "@/lib/cx";
import type { HostQuestion } from "@/lib/game/events";
import { Check } from "@/components/icons";
import { answerPositions, type AnswerPosition } from "./AnswerTile";
import { HostQuestionHeader, POSITIONS } from "./HostQuestionScreen";

const COLUMNS: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };

const BAR_COLOR: Record<AnswerPosition, string> = {
  1: "bg-tile-red",
  2: "bg-tile-blue",
  3: "bg-tile-yellow",
  4: "bg-tile-green",
};

type HostCountsScreenProps = {
  question: Pick<HostQuestion, "text" | "answers" | "positions">;
  /** The right answer, known only now that the question has closed. */
  correct: AnswerPosition;
  round: number;
  totalQuestions: number;
  counts: readonly [number, number, number, number];
};

/** After the question closed: one vertical bar per answer, the right one in full color with a check, the rest faded. */
export function HostCountsScreen({ question, correct, round, totalQuestions, counts }: HostCountsScreenProps) {
  const t = useTranslations("host.live");
  const format = useFormatter();
  const most = Math.max(1, ...counts);
  // Only the shapes the question has: a question with two answers shows two bars.
  const shown = POSITIONS.filter((position) => question.positions.includes(position));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <HostQuestionHeader round={round} totalQuestions={totalQuestions} />
      <h1 className="text-display font-black [overflow-wrap:anywhere]">{question.text}</h1>
      <ul className={cx("grid flex-1 gap-x-3 gap-y-0 pb-2 md:gap-x-6", COLUMNS[shown.length] ?? "grid-cols-4")}>
        {shown.map((position) => {
          const right = position === correct;
          const count = counts[position - 1] ?? 0;
          const barVars = { "--pct": `${(count / most) * 100}%` } as CSSProperties;
          const { Shape, tone } = answerPositions[position];
          return (
            <li key={position} className="flex min-w-0 flex-col gap-3">
              <div className="flex min-h-[200px] flex-1 flex-col items-center justify-end gap-2">
                <p className="text-display font-black tabular-nums" aria-label={t("count", { count, formatted: format.number(count) })}>
                  {format.number(count)}
                </p>
                <div className="flex h-[40vh] min-h-[120px] w-full items-end">
                  <div
                    style={barVars}
                    className={cx(
                      "min-h-2 w-full h-(--pct) rounded-t-md transition-[height] duration-200 ease-out motion-reduce:transition-none",
                      BAR_COLOR[position],
                      !right && "opacity-50",
                    )}
                  />
                </div>
              </div>
              <div
                className={cx(
                  "flex min-h-[72px] items-center gap-2 rounded-md p-3 text-body-lg font-bold [overflow-wrap:anywhere]",
                  tone,
                  "shadow-[0_4px_0_0_var(--tile-e)]",
                  !right && "opacity-50",
                )}
              >
                <Shape className="size-8 flex-none" />
                <span className="min-w-0 flex-1">{question.answers[position - 1]}</span>
                {right ? <Check width={28} height={28} className="flex-none" role="img" aria-label={t("correct")} /> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
