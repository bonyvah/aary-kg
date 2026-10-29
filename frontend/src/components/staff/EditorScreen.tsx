"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { useToast } from "@/components/ui/useToast";
import {
  MAX_READ_SECONDS,
  MAX_SECONDS,
  MIN_READ_SECONDS,
  MIN_SECONDS,
  READ_SECONDS_OPTIONS,
  SECONDS_OPTIONS,
} from "@/lib/quizEditor/reducer";
import { MAX_QUESTIONS } from "@/lib/quizEditor/importJson";
import { useCustomSeconds } from "@/lib/quizEditor/useCustomSeconds";
import { useQuizEditor } from "@/lib/quizEditor/useQuizEditor";
import { DEFAULT_READ_SECONDS, DEFAULT_SECONDS } from "@/lib/quizEditor/reducer";
import type { Quiz, QuizQuestion } from "@/types/quiz";
import { DocEditorScreen } from "./DocEditorScreen";
import { ImagePicker } from "./ImagePicker";
import { AiGenerateModal } from "./AiGenerateModal";
import { ImportQuestionsModal } from "./ImportQuestionsModal";
import { ImportQuizModal } from "./ImportQuizModal";

/** `draftId`: a new quiz is kept under it in this browser while it is written. */
export function EditorScreen({ quiz, draftId }: { quiz: Quiz; draftId: string | null }) {
  const t = useTranslations("staff.editor");
  const editor = useQuizEditor(quiz, draftId);
  const customSeconds = useCustomSeconds();
  const [importing, setImporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [picking, setPicking] = useState(false);
  const importToast = useToast();
  const { state } = editor;

  // The presets, the times typed earlier and the times already in this quiz, in one ascending list.
  const secondsOptions = Array.from(
    new Set([...SECONDS_OPTIONS, ...customSeconds.popular, ...state.doc.questions.map((q) => q.seconds)]),
  )
    .sort((a, b) => a - b)
    .map((seconds) => ({ value: seconds, label: String(seconds) }));
  // Reading time: the presets and the times already in this quiz.
  const readOptions = Array.from(new Set([...READ_SECONDS_OPTIONS, ...state.doc.questions.map((q) => q.readSeconds)]))
    .sort((a, b) => a - b)
    .map((seconds) => ({ value: seconds, label: String(seconds) }));
  // The blank question a new quiz starts with is replaced by an import, so it takes no room.
  const filled = state.doc.questions.filter((q) => q.text.trim() !== "" || q.answers.some((a) => a.trim() !== ""));

  function questionSettings(question: QuizQuestion) {
    function chooseSeconds(seconds: number) {
      customSeconds.move(question.seconds, seconds);
      editor.changeQuestion({ seconds });
    }
    const chooseReadSeconds = (readSeconds: number) => editor.changeQuestion({ readSeconds });
    return (
      <>
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
          onChange={chooseReadSeconds}
          custom={{
            label: t("customTimeLabel"),
            min: MIN_READ_SECONDS,
            max: MAX_READ_SECONDS,
            onCommit: chooseReadSeconds,
          }}
        />
      </>
    );
  }

  return (
    <DocEditorScreen
      editor={editor}
      titleLabel={t("titleLabel")}
      savedMessage={t("saved")}
      cover={<ImagePicker label={t("cover")} image={state.doc.image} onChange={(image) => editor.changeDoc({ image })} />}
      quickstart={
        <>
          <Button variant="secondary" onClick={() => setGenerating(true)}>
            {t("ai.open")}
          </Button>
          <Button variant="secondary" onClick={() => setPicking(true)}>
            {t("fromOthers")}
          </Button>
          <Button variant="secondary" onClick={() => setImporting(true)}>
            {t("import.open")}
          </Button>
        </>
      }
      questionSettings={questionSettings}
      toast={importToast.toast}
    >
      {picking ? (
        <ImportQuestionsModal
          room={MAX_QUESTIONS - filled.length}
          exclude={editor.isNew ? undefined : { kind: "quiz", id: state.doc.id }}
          onClose={() => setPicking(false)}
          onImport={(title, questions) => {
            // Questions from an exam sheet have no times: the quiz's defaults. A quiz's keep theirs.
            editor.importQuestions(
              title,
              questions.map(({ text, answers, correct, ...rest }) => ({
                text,
                answers: [...answers] as typeof answers,
                correct,
                seconds: "seconds" in rest ? (rest.seconds as number) : DEFAULT_SECONDS,
                readSeconds: "readSeconds" in rest ? (rest.readSeconds as number) : DEFAULT_READ_SECONDS,
              })),
            );
            setPicking(false);
            importToast.show("success", t("import.imported", { count: questions.length }));
          }}
        />
      ) : null}
      {generating ? (
        <AiGenerateModal
          room={MAX_QUESTIONS - filled.length}
          onClose={() => setGenerating(false)}
          onImport={(title, questions) => {
            editor.importQuestions(
              title || null,
              questions.map((q) => ({ ...q, seconds: DEFAULT_SECONDS, readSeconds: DEFAULT_READ_SECONDS })),
            );
            setGenerating(false);
            importToast.show("success", t("import.imported", { count: questions.length }));
          }}
        />
      ) : null}
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
    </DocEditorScreen>
  );
}
