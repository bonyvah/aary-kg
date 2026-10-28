"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { useToast } from "@/components/ui/useToast";
import { fromQuiz, MINUTES_OPTIONS } from "@/lib/examEditor";
import { MAX_QUESTIONS } from "@/lib/quizEditor/importJson";
import { useExamEditor } from "@/lib/quizEditor/useQuizEditor";
import type { Exam } from "@/types/exam";
import { DocEditorScreen } from "./DocEditorScreen";
import { AiGenerateModal } from "./AiGenerateModal";
import { ImportQuestionsModal } from "./ImportQuestionsModal";

/** `draftId`: a new exam sheet is kept under it in this browser while it is written. */
export function ExamEditorScreen({ exam, draftId }: { exam: Exam; draftId: string | null }) {
  const t = useTranslations("staff.examEditor");
  const te = useTranslations("staff.editor");
  const editor = useExamEditor(exam, draftId);
  const { minutes } = editor.state.doc;
  // The presets, plus a typed-in time limit this exam already has.
  const options = Array.from(new Set([...MINUTES_OPTIONS, minutes]))
    .sort((a, b) => a - b)
    .map((value) => ({ value, label: String(value) }));
  const choose = (value: number) => editor.changeDoc({ minutes: value });
  const [importing, setImporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const importToast = useToast();
  // The blank question a new exam starts with is replaced by an import, so it takes no room.
  const filled = editor.state.doc.questions.filter((q) => q.text.trim() !== "" || q.answers.some((a) => a.trim() !== ""));

  return (
    <DocEditorScreen
      editor={editor}
      titleLabel={t("titleLabel")}
      savedMessage={t("saved")}
      setupFields={
        <Dropdown
          label={t("minutesLabel")}
          wrapperClassName="w-full max-w-[200px]"
          value={minutes}
          options={options}
          selectedLabel={t("minutesOption", { minutes })}
          onChange={choose}
        />
      }
      quickstart={
        <>
          <Button variant="secondary" onClick={() => setGenerating(true)}>
            {te("ai.open")}
          </Button>
          <Button variant="secondary" onClick={() => setImporting(true)}>
            {te("fromOthers")}
          </Button>
        </>
      }
      toast={importToast.toast}
    >
      {generating ? (
        <AiGenerateModal
          room={MAX_QUESTIONS - filled.length}
          onClose={() => setGenerating(false)}
          onImport={(title, questions) => {
            editor.importQuestions(title || null, questions);
            setGenerating(false);
            importToast.show("success", t("fromQuiz.imported", { count: questions.length }));
          }}
        />
      ) : null}
      {importing ? (
        <ImportQuestionsModal
          room={MAX_QUESTIONS - filled.length}
          exclude={editor.isNew ? undefined : { kind: "exam", id: editor.state.doc.id }}
          onClose={() => setImporting(false)}
          onImport={(title, picked) => {
            editor.importQuestions(title, fromQuiz(picked));
            setImporting(false);
            importToast.show("success", t("fromQuiz.imported", { count: picked.length }));
          }}
        />
      ) : null}
    </DocEditorScreen>
  );
}
