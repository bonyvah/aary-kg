"use client";

import { useId, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { IconButton } from "@/components/ui/IconButton";
import { X } from "@phosphor-icons/react/ssr";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { generateQuestions, MAX_FILES, MAX_TOTAL_BYTES, type GeneratedQuestion } from "@/lib/api/ai";
import { toKnownCode, type KnownApiCode } from "@/lib/api/client";

const COUNT_OPTIONS = [5, 10, 15, 20] as const;
const MAX_COUNT = 30;
const ACCEPT = ".pdf,.docx,.pptx,.txt";

type AiGenerateModalProps = {
  /** How many questions the quiz or exam can still take. */
  room: number;
  onImport: (title: string, questions: GeneratedQuestion[]) => void;
  onClose: () => void;
};

/** A file or pasted text, how many questions and in which language: the questions land in the editor. */
export function AiGenerateModal({ room, onImport, onClose }: AiGenerateModalProps) {
  const t = useTranslations("staff.editor.ai");
  const tc = useTranslations("common");
  const locale = useLocale();
  const fileId = useId();
  const textId = useId();
  const [files, setFiles] = useState<File[]>([]);
  const format = useFormatter();
  const total = files.reduce((sum, f) => sum + f.size, 0);
  const tooBig = total > MAX_TOTAL_BYTES;
  const megabytes = (bytes: number) => format.number(bytes / (1024 * 1024), { maximumFractionDigits: 1 });
  const [text, setText] = useState("");
  const [count, setCount] = useState(Math.min(10, Math.max(1, room)));
  const [language, setLanguage] = useState<"ky" | "ru">(locale === "ru" ? "ru" : "ky");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<KnownApiCode | null>(null);
  const max = Math.max(1, Math.min(MAX_COUNT, room));
  const options = Array.from(new Set([...COUNT_OPTIONS.filter((n) => n <= max), count]))
    .sort((a, b) => a - b)
    .map((value) => ({ value, label: String(value) }));

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const result = await generateQuestions({ files, text, count, language });
      onImport(result.title, result.questions);
    } catch (failure) {
      setError(toKnownCode(failure));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      wide
      onClose={busy ? () => undefined : onClose}
      title={t("title")}
      actions={
        <>
          <Button variant="neutral" disabled={busy} onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button variant="success" disabled={busy || room <= 0 || tooBig || (files.length === 0 && text.trim() === "")} onClick={() => void generate()}>
            {busy ? <Spinner label={t("working")} /> : null}
            {t(busy ? "working" : "generate")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor={fileId} className={buttonClasses({ variant: "secondary" })}>
              {t(files.length > 0 ? "addFiles" : "pickFile")}
            </label>
            <input
              id={fileId}
              type="file"
              accept={ACCEPT}
              multiple
              className="sr-only"
              disabled={busy || files.length >= MAX_FILES}
              onChange={(event) => {
                const picked = Array.from(event.target.files ?? []);
                setFiles((current) => [...current, ...picked].slice(0, MAX_FILES));
                event.target.value = "";
                setError(null);
              }}
            />
            {files.length > 0 ? (
              <span className={tooBig ? "font-bold text-danger-text" : "text-body text-ink-muted"}>
                {t("total", { used: megabytes(total), max: megabytes(MAX_TOTAL_BYTES) })}
              </span>
            ) : (
              <span className="text-body text-ink-muted">{t("fileKinds")}</span>
            )}
          </div>
          {files.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-md bg-surface px-3">
                  <span className="min-w-0 flex-1 font-bold [overflow-wrap:anywhere]">{file.name}</span>
                  <span className="text-body text-ink-muted tabular-nums">{t("size", { size: megabytes(file.size) })}</span>
                  <IconButton
                    label={t("removeFile", { name: file.name })}
                    title={t("removeFile", { name: file.name })}
                    disabled={busy}
                    onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                  >
                    <X weight="bold" size={22} aria-hidden="true" />
                  </IconButton>
                </li>
              ))}
            </ul>
          ) : null}
          {tooBig ? (
            <p role="alert" className="text-caption font-bold text-danger-text">
              {t("tooBig")}
            </p>
          ) : null}
        </div>
        {files.length > 0 ? null : (
          <div className="flex flex-col gap-2">
            <label htmlFor={textId} className="text-body font-bold text-ink">
              {t("pasteLabel")}
            </label>
            <textarea
              id={textId}
              value={text}
              rows={8}
              disabled={busy}
              onChange={(event) => {
                setText(event.target.value);
                setError(null);
              }}
              className="w-full resize-y rounded-md border-2 border-field-border bg-field px-4 py-3 text-body text-on-field focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            />
          </div>
        )}
        <div className="flex flex-wrap gap-4">
          <Dropdown
            label={t("count")}
            wrapperClassName="w-full max-w-[200px]"
            value={count}
            options={options}
            onChange={setCount}
            // At the bottom of the dialog: opening down would be cut off by its edge.
            placement="up"
            custom={{ label: t("customCount"), min: 1, max, onCommit: setCount }}
          />
          <Select
            label={t("language")}
            wrapperClassName="w-full max-w-[200px]"
            value={language}
            disabled={busy}
            onChange={(event) => setLanguage(event.target.value === "ru" ? "ru" : "ky")}
          >
            <option value="ky">{t("languages.ky")}</option>
            <option value="ru">{t("languages.ru")}</option>
          </Select>
        </div>
        {error ? (
          <p role="alert" className="text-body font-bold text-danger-text">
            {tc(`apiError.${error}`)}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
