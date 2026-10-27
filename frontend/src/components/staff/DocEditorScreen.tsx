"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { AnswerPosition } from "@/components/game/AnswerTile";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Input } from "@/components/ui/Input";
import { Toast, ToastRegion } from "@/components/ui/Toast";
import { knownCode } from "@/lib/api/client";
import { answerKey, textKey, type EditorDoc } from "@/lib/quizEditor/reducer";
import type { DocEditor } from "@/lib/quizEditor/useQuizEditor";
import { AnswerEditor } from "./AnswerEditor";
import { QuestionList } from "./QuestionList";
import { StaffMenu } from "./StaffMenu";
import { StaffTopBar } from "./StaffShell";

const POSITIONS: readonly AnswerPosition[] = [1, 2, 3, 4];
const TOAST_MS = 3000;
const QUESTION_INPUT_ID = "editor-question-text";

type DocEditorScreenProps<D extends EditorDoc> = {
  editor: DocEditor<D>;
  titleLabel: string;
  savedMessage: string;
  /** Next to the title, before «save»: the quiz's import, the exam's time limit. */
  toolbar: ReactNode;
  /** After the toolbar, before «save». */
  toolbarEnd?: ReactNode;
  /** Under the answers, before «remove question»: the quiz question's times. */
  questionSettings?: (question: D["questions"][number]) => ReactNode;
  /** Shown when there is no save result to show. */
  toast?: ReactNode;
  children?: ReactNode;
};

/** The editor of a quiz or an exam: title bar, question list, the selected question. */
export function DocEditorScreen<D extends EditorDoc>({
  editor,
  titleLabel,
  savedMessage,
  toolbar,
  toolbarEnd,
  questionSettings,
  toast,
  children,
}: DocEditorScreenProps<D>) {
  const t = useTranslations("staff.editor");
  const tc = useTranslations("common");
  const { state } = editor;
  const index = Math.max(0, state.doc.questions.findIndex((q) => q.id === state.selectedId));
  const question = state.doc.questions[index];

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

  const required = t("errors.FIELD_REQUIRED");
  const invalidIds = new Set(
    state.doc.questions.filter((q) => [...state.errors].some((key) => key.startsWith(`${q.id}:`))).map((q) => q.id),
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <StaffTopBar topRight={<StaffMenu />} />
      <div className="mx-auto flex w-full max-w-[1100px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-6">
        <ButtonLink href="/dashboard" variant="neutral">
          {t("back")}
        </ButtonLink>
        <div className="min-w-[200px] flex-1">
          <Input
            hideLabel
            label={titleLabel}
            value={state.doc.title}
            maxLength={200}
            onChange={(event) => editor.setTitle(event.target.value)}
            error={state.errors.has("title") ? required : undefined}
          />
        </div>
        {toolbar}
        {toolbarEnd}
        <Button variant="success" disabled={editor.saving} onClick={() => void editor.save()}>
          {t("save")}
        </Button>
      </div>

      <div className="mx-auto grid w-full max-w-[1100px] flex-1 grid-cols-[minmax(0,1fr)] md:grid-cols-[280px_minmax(0,1fr)]">
        <QuestionList
          questions={state.doc.questions}
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
            {questionSettings?.(question)}
            <Button
              variant="danger"
              disabled={state.doc.questions.length <= 1}
              onClick={() => editor.removeQuestion(question.id)}
            >
              {t("removeQuestion")}
            </Button>
          </div>
        </main>
      </div>

      {children}

      {state.saveResult ? (
        <ToastRegion>
          <Toast variant={state.saveResult === "saved" ? "success" : "danger"}>
            {state.saveResult === "saved"
              ? savedMessage
              : state.saveResult === "invalid"
                ? t("saveFailed")
                : tc(`apiError.${knownCode(state.failedCode ?? "UNKNOWN")}`)}
          </Toast>
        </ToastRegion>
      ) : (
        toast
      )}
    </div>
  );
}
