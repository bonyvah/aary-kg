"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { CaretDown } from "@phosphor-icons/react/ssr";
import { useTranslations } from "next-intl";
import { answerPositions, type AnswerPosition } from "@/components/game/AnswerTile";
import { Check } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { copyLibraryQuiz, type LibraryQuiz } from "@/lib/api/quizzes";
import { toKnownCode } from "@/lib/api/client";
import { useToast } from "@/components/ui/useToast";
import { writeHostGame } from "@/lib/hostFlow/hostGame";
import { downloadJson } from "@/lib/quizEditor/exportJson";
import type { Quiz } from "@/types/quiz";
import { StaffMenu } from "./StaffMenu";
import { StaffShell } from "./StaffShell";

const POSITIONS: readonly AnswerPosition[] = [1, 2, 3, 4];

type QuizViewScreenProps =
  | { quiz: Quiz; library?: false }
  /** Another teacher's quiz from the library: read it and copy it. */
  | { quiz: LibraryQuiz; library: true };

/** A quiz to read before hosting it (or copying it): the questions, with their answers hidden until opened. */
export function QuizViewScreen(props: QuizViewScreenProps) {
  const { quiz } = props;
  const t = useTranslations("staff.quizView");
  const tc = useTranslations("common");
  const router = useRouter();
  const { toast, show } = useToast();
  const [copying, setCopying] = useState(false);

  async function copy() {
    setCopying(true);
    try {
      const mine = await copyLibraryQuiz(quiz.id);
      router.push(`/quizzes/view/${mine.id}`);
    } catch (error) {
      show("danger", tc(`apiError.${toKnownCode(error)}`));
      setCopying(false);
    }
  }
  const baseId = useId();
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const allOpen = open.size === quiz.questions.length;

  function toggle(id: string) {
    const next = new Set(open);
    if (!next.delete(id)) next.add(id);
    setOpen(next);
  }

  return (
    <StaffShell topRight={<StaffMenu />}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-h1 font-black [overflow-wrap:anywhere]">{quiz.title}</h1>
          {props.library ? <p className="text-body-lg font-bold text-ink-muted">{props.quiz.ownerName}</p> : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={props.library ? "/quizzes/library" : "/dashboard"} variant="neutral">
            {t("back")}
          </ButtonLink>
          {props.library ? (
            <Button variant="success" disabled={copying} onClick={() => void copy()}>
              {t("copy")}
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => downloadJson(props.quiz)}>
                {t("exportJson")}
              </Button>
              <ButtonLink href={`/quizzes/manage/${quiz.id}`} variant="secondary">
                {t("edit")}
              </ButtonLink>
              <ButtonLink href={`/host/${quiz.id}`} variant="accent" onClick={() => writeHostGame(quiz.id, null)}>
                {t("start")}
              </ButtonLink>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h3 font-bold">{t("questions", { count: quiz.questions.length })}</h2>
        <Button
          variant="neutral"
          onClick={() => setOpen(allOpen ? new Set() : new Set(quiz.questions.map((q) => q.id)))}
        >
          {allOpen ? t("collapseAll") : t("expandAll")}
        </Button>
      </div>

      <ol className="flex flex-col gap-4">
        {quiz.questions.map((question, index) => {
          const isOpen = open.has(question.id);
          const panelId = `${baseId}-${question.id}`;
          return (
            <li key={question.id}>
              <Card className="flex flex-col gap-4 p-0">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggle(question.id)}
                  className={cx(
                    "flex w-full cursor-pointer items-center gap-4 rounded-lg p-4 text-left md:p-6",
                    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-bold text-ink-muted">
                      {t("question", { number: index + 1 })} · {t("seconds", { seconds: question.seconds })}
                    </span>
                    <span className="block text-body-lg font-bold [overflow-wrap:anywhere]">{question.text}</span>
                  </span>
                  <Icon icon={CaretDown} className={cx("shrink-0 transition-transform duration-150", isOpen && "rotate-180")} />
                </button>
                {isOpen ? (
                  <div id={panelId} className="grid gap-3 px-4 pb-4 sm:grid-cols-2 md:px-6 md:pb-6">
                    {POSITIONS.map((position) => {
                      const text = question.answers[position - 1] ?? "";
                      if (text.trim() === "") return null;
                      const { Shape, tone } = answerPositions[position];
                      const correct = question.correct === position;
                      return (
                        <div
                          key={position}
                          className={cx("flex items-center gap-3 rounded-md p-3 shadow-[0_4px_0_0_var(--tile-e)]", tone)}
                        >
                          <Shape className="size-8 flex-none" />
                          <span className="min-w-0 flex-1 text-body-lg font-bold [overflow-wrap:anywhere]">{text}</span>
                          {correct ? (
                            <>
                              <Check width={28} height={28} className="flex-none" aria-hidden />
                              <span className="sr-only">{t("correct")}</span>
                            </>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ol>
      {toast}
    </StaffShell>
  );
}
