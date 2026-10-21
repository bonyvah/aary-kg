"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { AnswerPosition } from "@/components/game/AnswerTile";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Input } from "@/components/ui/Input";
import { Dropdown } from "@/components/ui/Dropdown";
import { Toast, ToastRegion } from "@/components/ui/Toast";
import { useToast } from "@/components/ui/useToast";
import { knownCode } from "@/lib/api/client";
import {
  answerKey,
  MAX_READ_SECONDS,
  MAX_SECONDS,
  MIN_READ_SECONDS,
  MIN_SECONDS,
  READ_SECONDS_OPTIONS,
  SECONDS_OPTIONS,
  textKey,
} from "@/lib/quizEditor/reducer";
import { MAX_QUESTIONS } from "@/lib/quizEditor/importJson";
import { useCustomSeconds } from "@/lib/quizEditor/useCustomSeconds";
import { useQuizEditor } from "@/lib/quizEditor/useQuizEditor";
import type { Quiz } from "@/types/quiz";
import { AnswerEditor } from "./AnswerEditor";
import { ImportQuizModal } from "./ImportQuizModal";
import { QuestionList } from "./QuestionList";
import { StaffMenu } from "./StaffMenu";
import { StaffTopBar } from "./StaffShell";

const POSITIONS: readonly AnswerPosition[] = [1, 2, 3, 4];
const TOAST_MS = 3000;
const QUESTION_INPUT_ID = "editor-question-text";

export function EditorScreen({ quiz }: { quiz: Quiz }) {
  const t = useTranslations("staff.editor");
  const tc = useTranslations("common");
  const editor = useQuizEditor(quiz);
  const customSeconds = useCustomSeconds();
  const [importing, setImporting] = useState(false);
  const importToast = useToast();
  const { state } = editor;
  const index = Math.max(0, state.quiz.questions.findIndex((q) => q.id === state.selectedId));
  const question = state.quiz.questions[index];

  useEffect(() => {
    if (!state.saveResult) return;
    const timer = setTimeout(editor.clearSaveResult, TOAST_MS);
    return () => clearTimeout(timer);
  }, [state.saveResult, editor.clearSaveResult]);

  // Opening another question (picking it, or adding one) puts the cursor in its text box.
  const shownId = useRef(question?.id);
  useEffect(() => {
    if (!question || shownId.current === question.id) return;
    shownId.current = question.id;
    document.getElementById(QUESTION_INPUT_ID)?.focus();
  }, [question]);

  if (!question) return null;

  function chooseSeconds(seconds: number) {
    customSeconds.move(question?.seconds ?? seconds, seconds);
    editor.setSeconds(seconds);
  }

  const required = t("errors.FIELD_REQUIRED");
  // The presets, the times typed earlier and the times already in this quiz, in one ascending list.
  const secondsOptions = Array.from(
    new Set([...SECONDS_OPTIONS, ...customSeconds.popular, ...state.quiz.questions.map((q) => q.seconds)]),
  )
    .sort((a, b) => a - b)
    .map((seconds) => ({ value: seconds, label: String(seconds) }));
  // Reading time: the presets and the times already in this quiz.
  const readOptions = Array.from(new Set([...READ_SECONDS_OPTIONS, ...state.quiz.questions.map((q) => q.readSeconds)]))
    .sort((a, b) => a - b)
    .map((seconds) => ({ value: seconds, label: String(seconds) }));
  // The blank question a new quiz starts with is replaced by an import, so it takes no room.
  const filled = state.quiz.questions.filter((q) => q.text.trim() !== "" || q.answers.some((a) => a.trim() !== ""));
  const invalidIds = new Set(
    state.quiz.questions.filter((q) => [...state.errors].some((key) => key.startsWith(`${q.id}:`))).map((q) => q.id),
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <StaffTopBar topRight={<StaffMenu />} />
      <div className="mx-auto flex w-full max-w-[1100px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-6">
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
        <Button variant="neutral" onClick={() => setImporting(true)}>
          {t("import.open")}
        </Button>
        <Button variant="success" disabled={editor.saving} onClick={() => void editor.save()}>
          {t("save")}
        </Button>
      </div>

      <div className="mx-auto grid w-full max-w-[1100px] flex-1 grid-cols-[minmax(0,1fr)] md:grid-cols-[280px_minmax(0,1fr)]">
        <QuestionList
          questions={state.quiz.questions}
          selectedId={question.id}
          invalidIds={invalidIds}
          onSelect={editor.select}
          onAdd={editor.addQuestion}
        />
        <main
          className="flex min-w-0 flex-col gap-6 p-4 md:p-6"
          onKeyDown={(event) => {
            // Enter in the question or an answer text adds the next question (the same check as the add button). The time field handles its own Enter.
            if (event.key !== "Enter" || !(event.target instanceof HTMLInputElement) || event.target.closest("[role=listbox]")) return;
            event.preventDefault();
            editor.addQuestion();
          }}
        >
          <Input
            id={QUESTION_INPUT_ID}
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
            <Dropdown
              label={t("timeLabel")}
              wrapperClassName="w-full max-w-[240px]"
              value={question.seconds}
              options={secondsOptions}
              selectedLabel={t("timeOption", { seconds: question.seconds })}
              onChange={chooseSeconds}
              custom={{
                label: t("customTimeLabel"),
                min: MIN_SECONDS,
                max: MAX_SECONDS,
                onCommit: chooseSeconds,
              }}
            />
            <Dropdown
              label={t("readLabel")}
              wrapperClassName="w-full max-w-[240px]"
              value={question.readSeconds}
              options={readOptions}
              selectedLabel={t("timeOption", { seconds: question.readSeconds })}
              onChange={editor.setReadSeconds}
              custom={{
                label: t("customTimeLabel"),
                min: MIN_READ_SECONDS,
                max: MAX_READ_SECONDS,
                onCommit: editor.setReadSeconds,
              }}
            />
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

      <ImportQuizModal
        open={importing}
        room={MAX_QUESTIONS - filled.length}
        onClose={() => setImporting(false)}
        onImport={(title, questions) => {
          editor.importQuestions(title, questions);
          setImporting(false);
          importToast.show("success", t("import.imported", { count: questions.length }));
        }}
      />

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
      ) : (
        importToast.toast
      )}
    </div>
  );
}
