"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AnswerTile, type AnswerPosition } from "@/components/game/AnswerTile";
import { FullscreenGate } from "@/components/game/FullscreenGate";
import { TimerBar } from "@/components/game/TimerBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ImageFrame } from "@/components/ui/ImageFrame";
import { useToast } from "@/components/ui/useToast";
import { ApiRequestError, toKnownCode } from "@/lib/api/client";
import { saveAnswer, sendSignal, submitStudentExam } from "@/lib/api/studentExams";
import type { PlayerMessage } from "@/lib/game/events";
import { useScreenGuard } from "@/lib/playerFlow/useScreenGuard";
import { cx } from "@/lib/cx";
import { clock, useCountdown, usedPositions } from "@/lib/studentExam";
import type { StudentExam, StudentQuestion } from "@/types/studentExam";
import { ConfirmModal } from "./ConfirmModal";

type ExamTakingScreenProps = {
  exam: StudentExam & { questions: StudentQuestion[] };
  /** The attempt ended (submitted here, time up or the exam closed): reload what the server says. */
  onEnded: (exam?: StudentExam) => void;
};

const URGENT_SECONDS = 60;

/** The exam itself: one question at a time, free to move between them, answers saved as they are picked. */
export function ExamTakingScreen({ exam, onEnded }: ExamTakingScreenProps) {
  const t = useTranslations("student.exam.taking");
  const tc = useTranslations("common");
  const { toast, show } = useToast();
  const questions = exam.questions;
  const attempt = exam.attempt;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerPosition>>(attempt?.answers ?? {});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const left = useCountdown(attempt?.secondsLeft ?? 0, attempt?.deadlineAt);
  const question = questions[index] ?? questions[0];
  const currentId = useRef<string | null>(question?.id ?? null);
  currentId.current = question?.id ?? null;

  const send = useCallback(
    (message: PlayerMessage) => {
      if (message.type === "signal") void sendSignal(exam.id, message.kind, currentId.current).catch(() => undefined);
    },
    [exam.id],
  );
  const guard = useScreenGuard(true, true, send);

  useEffect(() => {
    const onPaste = () => send({ type: "signal", kind: "PASTE" });
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [send]);

  if (!question) return null;
  const unanswered = questions.filter((q) => answers[q.id] === undefined).length;

  async function pick(position: AnswerPosition) {
    if (!question) return;
    const id = question.id;
    const previous = answers[id];
    const next = previous === position ? null : position;
    setAnswers((current) => {
      const copy = { ...current };
      if (next === null) delete copy[id];
      else copy[id] = next;
      return copy;
    });
    try {
      await saveAnswer(exam.id, id, next);
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "ATTEMPT_FINISHED") {
        onEnded();
        return;
      }
      setAnswers((current) => {
        const copy = { ...current };
        if (previous === undefined) delete copy[id];
        else copy[id] = previous;
        return copy;
      });
      show("danger", t("notSaved"));
    }
  }

  async function submit() {
    setBusy(true);
    try {
      onEnded(await submitStudentExam(exam.id));
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "ATTEMPT_FINISHED") onEnded();
      else show("danger", tc(`apiError.${toKnownCode(error)}`));
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-surface-raised">
        <div className="mx-auto flex min-h-[64px] w-full max-w-[1100px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">
          <p className="min-w-0 flex-1 truncate text-h3 font-bold" title={exam.title}>
            {exam.title}
          </p>
          <TimerBar
            className="w-full max-w-[420px] sm:w-auto sm:flex-1"
            remaining={left}
            total={exam.minutes * 60}
            unit=""
            display={clock(left)}
            urgentAt={URGENT_SECONDS}
          />
          <Button variant="success" onClick={() => setConfirming(true)}>
            {t("submit")}
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-6 p-4 md:p-6">
        <nav aria-label={t("questions")}>
          <ol className="flex flex-wrap gap-2">
            {questions.map((q, i) => {
              const answered = answers[q.id] !== undefined;
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    aria-current={i === index ? "step" : undefined}
                    aria-label={t(answered ? "questionAnswered" : "questionOpen", { number: i + 1 })}
                    onClick={() => setIndex(i)}
                    className={cx(
                      "grid size-11 place-items-center rounded-md text-body-lg font-black tabular-nums",
                      "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
                      answered ? "bg-field text-on-field" : "bg-surface-raised text-ink",
                      i === index && "outline-3 outline-offset-2 outline-accent",
                    )}
                  >
                    {i + 1}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="flex flex-col gap-3">
          <div>
            <Badge>{t("counter", { current: index + 1, total: questions.length })}</Badge>
          </div>
          <h1 className="text-h1 font-black [overflow-wrap:anywhere]">{question.text}</h1>
          <ImageFrame image={question.image} className="w-full max-w-[640px] rounded-md" />
        </div>

        <div className="grid gap-4 pb-2 sm:grid-cols-2">
          {usedPositions(question.answers).map((position) => (
            <AnswerTile key={position} position={position} pressed={answers[question.id] === position} onClick={() => void pick(position)}>
              {question.answers[position - 1]}
            </AnswerTile>
          ))}
        </div>

        <div className="mt-auto flex flex-wrap justify-between gap-4">
          <Button variant="neutral" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
            {t("previous")}
          </Button>
          {index === questions.length - 1 || unanswered === 0 ? (
            <Button variant="success" onClick={() => setConfirming(true)}>
              {t("submit")}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}>
              {t("next")}
            </Button>
          )}
        </div>
      </main>

      <ConfirmModal
        open={confirming}
        title={t("confirm.title")}
        body={unanswered > 0 ? t("confirm.unanswered", { count: unanswered }) : t("confirm.allAnswered")}
        confirmLabel={t("submit")}
        cancelLabel={t("confirm.cancel")}
        variant="success"
        busy={busy}
        onConfirm={() => void submit()}
        onClose={() => setConfirming(false)}
      />
      {guard.blocked ? <FullscreenGate namespace="student.exam.fullscreen" onEnter={guard.enter} /> : null}
      {toast}
    </div>
  );
}
