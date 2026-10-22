"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import type { HostQuestion } from "@/lib/game/events";
import { cx } from "@/lib/cx";
import { AnswerTile, type AnswerPosition } from "./AnswerTile";
import { CountdownRing } from "./CountdownRing";
import { TimerBar } from "./TimerBar";

export const POSITIONS: readonly AnswerPosition[] = [1, 2, 3, 4];

type HostQuestionHeaderProps = {
  round: number;
  totalQuestions: number;
  /** Shown on the right as «12 / 18 answered» while the question is open. */
  answered?: { count: number; total: number };
};

export function HostQuestionHeader({ round, totalQuestions, answered }: HostQuestionHeaderProps) {
  const t = useTranslations("host.live");
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Badge>{t("counter", { current: round, total: totalQuestions })}</Badge>
      {answered ? <Badge>{t("answered", { count: answered.count, total: answered.total })}</Badge> : null}
    </div>
  );
}

type HostQuestionScreenProps = {
  question: Pick<HostQuestion, "index" | "text" | "answers" | "seconds" | "readSeconds" | "positions">;
  round: number;
  totalQuestions: number;
  secondsLeft: number;
  /** While above 0 the question is being read: the timer waits, full. */
  readingLeft: number;
  answered: number;
  total: number;
};

/**
 * The open question on the projector: the question, the clock and all four answers WITH their text.
 * While it is being read: only the question and the reading countdown.
 */
export function HostQuestionScreen({ question, round, totalQuestions, secondsLeft, readingLeft, answered, total }: HostQuestionScreenProps) {
  const t = useTranslations("host.live");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <HostQuestionHeader round={round} totalQuestions={totalQuestions} answered={{ count: answered, total }} />
      <h1 className="text-display font-black [overflow-wrap:anywhere]">{question.text}</h1>
      {readingLeft > 0 ? (
        <CountdownRing
          key={question.index}
          className="m-auto"
          size="lg"
          remaining={readingLeft}
          total={question.readSeconds}
          unit={t("unit")}
        />
      ) : (
        <>
          <TimerBar remaining={secondsLeft} total={question.seconds} unit={t("unit")} />
          <div className="grid grid-cols-1 gap-4 pb-2 sm:grid-cols-2">
            {POSITIONS.filter((position) => question.positions.includes(position)).map((position, index, shown) => (
              <AnswerTile
                key={position}
                position={position}
                disabled
                className={cx("pointer-events-none", index === shown.length - 1 && shown.length % 2 === 1 && "sm:col-span-2")}
              >
                {question.answers[position - 1]}
              </AnswerTile>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
