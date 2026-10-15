"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import type { AnswerPosition } from "@/components/game/AnswerTile";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Toast, ToastRegion } from "@/components/ui/Toast";
import { knownCode } from "@/lib/api/client";
import { answerKey, NEW_QUIZ_ID, SECONDS_OPTIONS, textKey } from "@/lib/quizEditor/reducer";
import { useQuizEditor } from "@/lib/quizEditor/useQuizEditor";
import type { Quiz } from "@/types/quiz";
import { AnswerEditor } from "./AnswerEditor";
import { QuestionList } from "./QuestionList";

const POSITIONS: readonly AnswerPosition[] = [1, 2, 3, 4];
const TOAST_MS = 3000;

export function EditorScreen({ quiz }: { quiz: Quiz }) {
  const t = useTranslations("staff.editor");
  const tc = useTranslations("common");
  const editor = useQuizEditor(quiz);
  const { state } = editor;
  const index = Math.max(0, state.quiz.questions.findIndex((q) => q.id === state.selectedId));
  const question = state.quiz.questions[index];

  useEffect(() => {
    if (!state.saveResult) return;
    const timer = setTimeout(editor.clearSaveResult, TOAST_MS);
    return () => clearTimeout(timer);
  }, [state.saveResult, editor.clearSaveResult]);

  if (!question) return null;

  const required = t("errors.FIELD_REQUIRED");
  const invalidIds = new Set(
    state.quiz.questions.filter((q) => [...state.errors].some((key) => key.startsWith(`${q.id}:`))).map((q) => q.id),
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-surface-raised">
        <div className="mx-auto flex w-full max-w-[1100px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <ButtonLink href="/dashboard" variant="secondary">
            {t("back")}
          </ButtonLink>
          <div className="min-w-[200px] flex-1">
            <Input
              hideLabel
              label={t("titleLabel")}
              value={state.quiz.title}
              maxLength={200}
              onChange={(event) => editor.setTitle(event.target.value)}
              error={state.errors.has("title") ? required : undefined}
            />
          </div>
          {/* There is nothing to host until the quiz is saved. */}
          {state.quiz.id === NEW_QUIZ_ID ? (
            <Button variant="accent" disabled>
              {t("host")}
            </Button>
          ) : (
            <ButtonLink href={`/host/${state.quiz.id}`} variant="accent">
              {t("host")}
            </ButtonLink>
          )}
          <Button variant="success" disabled={editor.saving} onClick={() => void editor.save()}>
            {t("save")}
          </Button>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1100px] flex-1 grid-cols-[minmax(0,1fr)] md:grid-cols-[280px_minmax(0,1fr)]">
        <QuestionList
          questions={state.quiz.questions}
          selectedId={question.id}
          invalidIds={invalidIds}
          onSelect={editor.select}
          onAdd={editor.addQuestion}
        />
        <main className="flex min-w-0 flex-col gap-6 p-4 md:p-6">
          <Input
            label={t("questionLabel")}
            value={question.text}
            maxLength={500}
            onChange={(event) => editor.setQuestionText(event.target.value)}
            error={state.errors.has(textKey(question.id)) ? required : undefined}
          />
          <div role="radiogroup" aria-label={t("correctGroup")} className="grid gap-4 pb-2 sm:grid-cols-2">
            {POSITIONS.map((position) => (
              <AnswerEditor
                key={position}
                position={position}
                value={question.answers[position - 1] ?? ""}
                correct={question.correct === position}
                error={state.errors.has(answerKey(question.id, position)) ? required : undefined}
                onChange={(text) => editor.setAnswerText(position, text)}
                onMarkCorrect={() => editor.setCorrect(position)}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Select
              label={t("timeLabel")}
              wrapperClassName="w-full max-w-[240px]"
              value={question.seconds}
              onChange={(event) => editor.setSeconds(Number(event.target.value))}
            >
              {SECONDS_OPTIONS.map((seconds) => (
                <option key={seconds} value={seconds}>
                  {t("timeOption", { seconds })}
                </option>
              ))}
            </Select>
            <Button
              variant="danger"
              disabled={state.quiz.questions.length <= 1}
              onClick={() => editor.removeQuestion(question.id)}
            >
              {t("removeQuestion")}
            </Button>
          </div>
        </main>
      </div>

      {state.saveResult ? (
        <ToastRegion>
          <Toast variant={state.saveResult === "saved" ? "success" : "danger"}>
            {state.saveResult === "saved"
              ? t("saved")
              : state.saveResult === "invalid"
                ? t("saveFailed")
                : tc(`apiError.${knownCode(state.failedCode ?? "UNKNOWN")}`)}
          </Toast>
        </ToastRegion>
      ) : null}
    </div>
  );
}
