"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { AnswerPosition } from "@/components/game/AnswerTile";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Input } from "@/components/ui/Input";
import { Toast, ToastRegion } from "@/components/ui/Toast";
import { knownCode } from "@/lib/api/client";
import { hasContent } from "@/lib/quizEditor/drafts";
import { downloadJson } from "@/lib/quizEditor/exportJson";
import { answerKey, textKey, type EditorDoc } from "@/lib/quizEditor/reducer";
import type { DocEditor } from "@/lib/quizEditor/useQuizEditor";
import { AnswerEditor } from "./AnswerEditor";
import { ConfirmModal } from "./ConfirmModal";
import { QuestionList } from "./QuestionList";
import { QuestionOrder } from "./QuestionOrder";
import { StaffMenu } from "./StaffMenu";
import { StaffTopBar } from "./StaffShell";

const POSITIONS: readonly AnswerPosition[] = [1, 2, 3, 4];
const TOAST_MS = 3000;
const QUESTION_INPUT_ID = "editor-question-text";

type Step = "setup" | "questions";

type DocEditorScreenProps<D extends EditorDoc> = {
  editor: DocEditor<D>;
  titleLabel: string;
  savedMessage: string;
  /** Step 1, beside the name: the exam's time limit. */
  setupFields?: ReactNode;
  /** Step 1: ways to fill the questions quickly (from material, from a quiz, JSON). */
  quickstart: ReactNode;
  /** Step 2, under the answers, before «remove question»: the quiz question's times. */
  questionSettings?: (question: D["questions"][number]) => ReactNode;
  /** Shown when there is no save result to show. */
  toast?: ReactNode;
  children?: ReactNode;
};

/**
 * The editor of a quiz or an exam sheet, in two steps. Step 1: the name (and the exam's time),
 * quick ways to fill it, and the questions in order (drag to reorder); it can be saved from there.
 * Step 2: the questions themselves. A new one is kept as a draft in this browser until it is saved.
 */
export function DocEditorScreen<D extends EditorDoc>({
  editor,
  titleLabel,
  savedMessage,
  setupFields,
  quickstart,
  questionSettings,
  toast,
  children,
}: DocEditorScreenProps<D>) {
  const t = useTranslations("staff.editor");
  const tc = useTranslations("common");
  const { state } = editor;
  const [step, setStep] = useState<Step>("setup");
  const [discarding, setDiscarding] = useState(false);

  useEffect(() => {
    if (!state.saveResult) return;
    const timer = setTimeout(editor.clearSaveResult, TOAST_MS);
    return () => clearTimeout(timer);
  }, [state.saveResult, editor.clearSaveResult]);

  // A failed check on a question opens it in step 2 (the reducer selects the first one with an error).
  useEffect(() => {
    if (state.saveResult === "invalid" && [...state.errors].some((key) => key !== "title")) setStep("questions");
  }, [state.saveResult, state.errors]);

  const required = t("errors.FIELD_REQUIRED");
  const invalidIds = new Set(
    state.doc.questions.filter((q) => [...state.errors].some((key) => key.startsWith(`${q.id}:`))).map((q) => q.id),
  );

  const save = (
    <Button variant="success" disabled={editor.saving} onClick={() => void editor.save()}>
      {t("save")}
    </Button>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <StaffTopBar topRight={<StaffMenu />} />
      {step === "setup" ? (
        <main className="mx-auto flex w-full max-w-[900px] flex-1 flex-col gap-6 p-4 md:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href="/dashboard" variant="neutral">
              {t("back")}
            </ButtonLink>
            <div className="ml-auto flex flex-wrap gap-3">
              {editor.isNew && hasContent(state.doc) ? (
                <Button variant="neutral" onClick={() => setDiscarding(true)}>
                  {t("draft.discard")}
                </Button>
              ) : null}
              {editor.isNew ? null : (
                <Button variant="secondary" onClick={() => downloadJson(state.doc)}>
                  {t("exportJson")}
                </Button>
              )}
              {save}
              <Button variant="primary" onClick={() => setStep("questions")}>
                {t("toQuestions")}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <Input
              label={titleLabel}
              placeholder={titleLabel}
              value={state.doc.title}
              maxLength={200}
              wrapperClassName="min-w-[240px] flex-1"
              onChange={(event) => editor.setTitle(event.target.value)}
              error={state.errors.has("title") ? required : undefined}
            />
            {setupFields}
          </div>
          <div className="flex flex-wrap gap-3">{quickstart}</div>
          <section className="flex flex-col gap-3" aria-labelledby="order-title">
            <h2 id="order-title" className="text-h3 font-bold">
              {t("questionCount", { count: state.doc.questions.length })}
            </h2>
            <QuestionOrder
              questions={state.doc.questions}
              invalidIds={invalidIds}
              onMove={editor.moveQuestion}
              onOpen={(id) => {
                editor.select(id);
                setStep("questions");
              }}
            />
          </section>
        </main>
      ) : (
        <QuestionsStep
          editor={editor}
          invalidIds={invalidIds}
          questionSettings={questionSettings}
          header={
            <>
              <Button variant="neutral" onClick={() => setStep("setup")}>
                {t("toSetup")}
              </Button>
              <p className="min-w-0 flex-1 truncate text-h3 font-bold" title={state.doc.title}>
                {state.doc.title || titleLabel}
              </p>
              {save}
            </>
          }
        />
      )}

      {children}

      <ConfirmModal
        open={discarding}
        title={t("draft.discardTitle")}
        body={t("draft.discardBody")}
        confirmLabel={t("draft.discard")}
        cancelLabel={t("draft.keep")}
        onConfirm={() => {
          editor.discardDraft();
          setDiscarding(false);
        }}
        onClose={() => setDiscarding(false)}
      />

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

function QuestionsStep<D extends EditorDoc>({
  editor,
  invalidIds,
  questionSettings,
  header,
}: {
  editor: DocEditor<D>;
  invalidIds: ReadonlySet<string>;
  questionSettings?: (question: D["questions"][number]) => ReactNode;
  header: ReactNode;
}) {
  const t = useTranslations("staff.editor");
  const { state } = editor;
  const index = Math.max(0, state.doc.questions.findIndex((q) => q.id === state.selectedId));
  const question = state.doc.questions[index];
  const required = t("errors.FIELD_REQUIRED");

  // Opening another question (picking it, or adding one) puts the cursor in its text box.
  const shownId = useRef(question?.id);
  useEffect(() => {
    if (!question || shownId.current === question.id) return;
    shownId.current = question.id;
    document.getElementById(QUESTION_INPUT_ID)?.focus();
  }, [question]);

  if (!question) return null;

  return (
    <>
      <div className="mx-auto flex w-full max-w-[1100px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-6">{header}</div>
      <div className="mx-auto grid w-full max-w-[1100px] flex-1 grid-cols-[minmax(0,1fr)] md:grid-cols-[280px_minmax(0,1fr)]">
        <QuestionList
          questions={state.doc.questions}
          selectedId={question.id}
          invalidIds={invalidIds}
          onSelect={editor.select}
          onAdd={editor.addQuestion}
          onMove={editor.moveQuestion}
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
            <Button variant="danger" disabled={state.doc.questions.length <= 1} onClick={() => editor.removeQuestion(question.id)}>
              {t("removeQuestion")}
            </Button>
          </div>
        </main>
      </div>
    </>
  );
}
