"use client";

import { useTranslations } from "next-intl";
import { AnswerTile } from "@/components/game/AnswerTile";
import { Badge } from "@/components/ui/Badge";
import { usedPositions } from "@/lib/studentExam";
import type { StudentResult } from "@/types/studentExam";

/** The score, then every question with the correct answer marked and the student's wrong pick crossed. */
export function ExamResult({ result }: { result: StudentResult }) {
  const t = useTranslations("student.exam.result");

  return (
    <>
      <p className="text-display font-black tabular-nums">{t("score", { score: result.score, total: result.total })}</p>
      <ol className="flex flex-col gap-8">
        {result.questions.map((question, index) => (
          <li key={question.id} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{t("counter", { current: index + 1, total: result.total })}</Badge>
              {question.chosen === null ? <Badge variant="neutral">{t("unanswered")}</Badge> : null}
              {question.counted ? null : <Badge variant="danger">{t("notCounted")}</Badge>}
            </div>
            <h2 className="text-h2 font-black [overflow-wrap:anywhere]">{question.text}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {usedPositions(question.answers).map((position) => {
                const mark =
                  position === question.correct
                    ? ({ result: "ok", resultLabel: t("correct") } as const)
                    : position === question.chosen
                      ? ({ result: "no", resultLabel: t("wrong") } as const)
                      : ({ dim: true } as const);
                return (
                  <AnswerTile key={position} position={position} tabIndex={-1} {...mark}>
                    {question.answers[position - 1]}
                  </AnswerTile>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
