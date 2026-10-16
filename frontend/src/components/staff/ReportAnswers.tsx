import { useFormatter, useTranslations } from "next-intl";
import { Avatar } from "@/components/game/Avatar";
import { answerPositions, type AnswerPosition } from "@/components/game/AnswerTile";
import { Check, Cross } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { cx } from "@/lib/cx";
import type { GameReport, ReportAnswer, ReportPlayer, ReportQuestion } from "@/types/report";

function isPosition(value: number): value is AnswerPosition {
  return value >= 1 && value <= 4;
}

/** One answer of a question: its shape and color, its text, and a check when it is the right one. */
function AnswerChip({ question, position, mark }: { question: ReportQuestion; position: number; mark?: boolean }) {
  const t = useTranslations("staff.report.answers");
  if (!isPosition(position)) return null;
  const { Shape, tone } = answerPositions[position];
  return (
    <span className={cx("flex items-center gap-3 rounded-md px-3 py-2 shadow-[0_4px_0_0_var(--tile-e)]", tone)}>
      <Shape className="size-6 flex-none" />
      <span className="min-w-0 flex-1 font-bold wrap-anywhere">{question.answers[position - 1] ?? ""}</span>
      {mark ? (
        <>
          <Check width={24} height={24} className="flex-none" aria-hidden />
          <span className="sr-only">{t("right")}</span>
        </>
      ) : null}
    </span>
  );
}

function Verdict({ correct }: { correct: boolean }) {
  const t = useTranslations("staff.report.answers");
  return (
    <Badge variant={correct ? "success" : "danger"}>
      {correct ? <Check width={16} height={16} aria-hidden /> : <Cross width={16} height={16} aria-hidden />}
      {correct ? t("right") : t("wrong")}
    </Badge>
  );
}

function Timing({ answer }: { answer: ReportAnswer }) {
  const t = useTranslations("staff.report.answers");
  const format = useFormatter();
  return (
    <span className="whitespace-nowrap text-body text-ink-muted tabular-nums">
      {t("seconds", { seconds: format.number(answer.ms / 1000, { maximumFractionDigits: 1 }) })} ·{" "}
      {t("points", { points: answer.points })}
    </span>
  );
}

/** Everything one player answered: each question, the answer they chose, and whether it was right. */
export function PlayerAnswers({ player, questions }: { player: ReportPlayer; questions: ReportQuestion[] }) {
  const t = useTranslations("staff.report.answers");
  return (
    <ol className="flex flex-col gap-3">
      {questions.map((question, index) => {
        const answer = player.answers.find((a) => a.question === question.id);
        return (
          <li key={question.id} className="flex flex-col gap-2 rounded-md bg-surface px-4 py-3">
            <p className="font-bold wrap-anywhere">
              <span className="tabular-nums">{index + 1}.</span> {question.text}
            </p>
            {answer ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-[200px] flex-1">
                  <AnswerChip question={question} position={answer.position} />
                </div>
                <Verdict correct={answer.correct} />
                <Timing answer={answer} />
              </div>
            ) : (
              <p className="text-body text-ink-muted">{t("none")}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** One question: its answers with the right one marked, then every player and what they chose. */
export function QuestionAnswers({ question, players }: { question: ReportQuestion; players: GameReport["players"] }) {
  const t = useTranslations("staff.report.answers");
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {[1, 2, 3, 4].map((position) =>
          (question.answers[position - 1] ?? "").trim() === "" ? null : (
            <AnswerChip key={position} question={question} position={position} mark={question.correct === position} />
          ),
        )}
      </div>
      <ul className="flex flex-col gap-3">
        {players.map((player) => {
          const answer = player.answers.find((a) => a.question === question.id);
          return (
            <li key={player.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-surface px-4 py-3">
              <span className="flex min-w-[160px] flex-1 items-center gap-3">
                <Avatar character={player.character} />
                <span className="min-w-0 font-bold wrap-break-word">{player.nickname}</span>
              </span>
              {answer ? (
                <>
                  <div className="min-w-[200px] flex-1">
                    <AnswerChip question={question} position={answer.position} />
                  </div>
                  <Verdict correct={answer.correct} />
                  <Timing answer={answer} />
                </>
              ) : (
                <span className="flex-[2] text-body text-ink-muted">{t("none")}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
