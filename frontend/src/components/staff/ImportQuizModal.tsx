"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/useToast";
import { DEFAULT_SECONDS } from "@/lib/quizEditor/reducer";
import { parseQuizJson, type ImportedQuestion, type ImportError } from "@/lib/quizEditor/importJson";

/** A quiz of 100 questions as JSON is well under this. */
const MAX_JSON_BYTES = 1024 * 1024;

type ImportQuizModalProps = {
  open: boolean;
  /** How many questions the quiz can still take. */
  room: number;
  onClose: () => void;
  onImport: (title: string | null, questions: ImportedQuestion[]) => void;
};

/** Paste a quiz written by a chat assistant: copy the prompt or the format, paste the reply, add the questions. */
export function ImportQuizModal({ open, room, onClose, onImport }: ImportQuizModalProps) {
  const t = useTranslations("staff.editor.import");
  const [raw, setRaw] = useState("");
  const [errors, setErrors] = useState<ImportError[]>([]);
  const { toast, show } = useToast();
  const fieldId = useId();
  const errorsId = `${fieldId}-errors`;
  const fileInputId = useId();

  /** A .json file goes into the field, so it can be read and checked like pasted text. */
  async function readFile(file: File) {
    if (file.size > MAX_JSON_BYTES) {
      setErrors([{ code: "NOT_JSON" }]);
      return;
    }
    setRaw(await file.text());
    setErrors([]);
  }

  // A fresh field every time it opens.
  useEffect(() => {
    if (open) {
      setRaw("");
      setErrors([]);
    }
  }, [open]);

  // The example is built from translated sample text, so the format reads in the screen's language.
  const format = JSON.stringify(
    {
      title: t("sample.title"),
      questions: [
        {
          text: t("sample.question"),
          answers: [t("sample.answer1"), t("sample.answer2"), t("sample.answer3"), t("sample.answer4")],
          correct: 2,
          seconds: DEFAULT_SECONDS,
        },
      ],
    },
    null,
    2,
  );

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      show("success", t("copied"));
    } catch {
      show("danger", t("copyFailed"));
    }
  }

  function submit() {
    const result = parseQuizJson(raw, room);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    onImport(result.title, result.questions);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("title")}
      wide
      actions={
        <>
          <Button variant="neutral" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button variant="success" disabled={raw.trim() === ""} onClick={submit}>
            {t("submit")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => void copy(t("prompt", { format }))}>
            {t("promptToAi")}
          </Button>
          <label htmlFor={fileInputId} className={buttonClasses({ variant: "secondary" })}>
            {t("pickFile")}
          </label>
          <input
            id={fileInputId}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void readFile(file);
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={fieldId} className="text-body font-bold text-ink">
            {t("pasteLabel")}
          </label>
          <textarea
            id={fieldId}
            value={raw}
            rows={10}
            spellCheck={false}
            aria-invalid={errors.length > 0 ? true : undefined}
            aria-describedby={errors.length > 0 ? errorsId : undefined}
            onChange={(event) => {
              setRaw(event.target.value);
              setErrors([]);
            }}
            className="w-full resize-y rounded-md border-2 border-field-border bg-field px-4 py-3 text-body text-on-field focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring aria-invalid:border-danger"
          />
          {errors.length > 0 ? (
            <ul id={errorsId} role="alert" className="flex flex-col gap-1 text-caption font-bold text-danger-text">
              {errors.map((error, index) => (
                <li key={index}>{t(`errors.${error.code}`, { question: error.question ?? 0, room: error.room ?? 0 })}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      {toast}
    </Modal>
  );
}
