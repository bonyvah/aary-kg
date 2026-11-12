"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Plus, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/useToast";
import { ApiRequestError, toKnownCode } from "@/lib/api/client";
import { createSurveySheet, deleteSurveySheet, updateSurveySheet } from "@/lib/api/surveys";
import {
  KINDS,
  LIMIT_MODES,
  MAX_CHOICES,
  MAX_QUESTIONS,
  MAX_WORDS,
  MIN_CHOICES,
  NEW_SHEET_ID,
  blankQuestion,
  findIssues,
  nextId,
  toInput,
  withKind,
  withLimitMode,
} from "@/lib/surveyEditor";
import type { SelectLimitMode, SurveyQuestion, SurveyQuestionKind, SurveySheet } from "@/types/survey";
import { ConfirmModal } from "./ConfirmModal";
import { StaffMenu } from "./StaffMenu";
import { StaffTopBar } from "./StaffShell";

const BACK = "/admin";

/** An admin writes a survey sheet: its name and questions, each single choice, multiple select or open. */
export function SurveySheetEditorScreen({ sheet: initial }: { sheet: SurveySheet }) {
  const t = useTranslations("admin.surveys.editor");
  const te = useTranslations("admin.surveys.errors");
  const tc = useTranslations("common");
  const router = useRouter();
  const { toast, show } = useToast();
  const [sheet, setSheet] = useState(initial);
  const [issues, setIssues] = useState<ReadonlyMap<string, string>>(new Map());
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isNew = sheet.id === NEW_SHEET_ID;

  const error = (key: string) => {
    const code = issues.get(key);
    return code ? te(code) : undefined;
  };

  // A fixed field clears its error at once; the others stay until the next save.
  function edit(change: (s: SurveySheet) => SurveySheet, ...keys: string[]) {
    setSheet(change);
    if (keys.some((k) => issues.has(k))) setIssues((current) => new Map([...current].filter(([k]) => !keys.includes(k))));
  }

  const editQuestion = (id: string, change: (q: SurveyQuestion) => SurveyQuestion, ...keys: string[]) =>
    edit((s) => ({ ...s, questions: s.questions.map((q) => (q.id === id ? change(q) : q)) }), ...keys);

  function move(index: number, by: -1 | 1) {
    edit((s) => {
      const questions = [...s.questions];
      const [moved] = questions.splice(index, 1);
      if (moved) questions.splice(index + by, 0, moved);
      return { ...s, questions };
    });
  }

  async function save() {
    const found = findIssues(sheet);
    setIssues(found);
    if (found.size > 0) {
      show("danger", t("saveFailed"));
      return;
    }
    setBusy(true);
    try {
      const saved = isNew ? await createSurveySheet(toInput(sheet)) : await updateSurveySheet(sheet.id, toInput(sheet));
      setSheet(saved);
      show("success", t("saved"));
      if (isNew) router.replace(`/admin/surveys/sheets/${saved.id}`);
    } catch (failure) {
      if (failure instanceof ApiRequestError && failure.issues.length > 0) {
        setIssues(new Map(failure.issues.map((i) => [i.field, i.code])));
        show("danger", t("saveFailed"));
      } else show("danger", tc(`apiError.${toKnownCode(failure)}`));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setDeleting(false);
    try {
      await deleteSurveySheet(sheet.id);
      router.push(BACK);
    } catch (failure) {
      show("danger", tc(`apiError.${toKnownCode(failure)}`));
    }
  }

  const full = sheet.questions.length >= MAX_QUESTIONS;

  return (
    <div className="flex min-h-dvh flex-col">
      <StaffTopBar topRight={<StaffMenu />} />
      <main className="mx-auto flex w-full max-w-[900px] flex-1 flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink href={BACK} variant="neutral">
            {t("back")}
          </ButtonLink>
          <div className="ml-auto flex flex-wrap gap-3">
            {isNew ? null : (
              <>
                <Button variant="danger" onClick={() => setDeleting(true)}>
                  {t("delete")}
                </Button>
                <ButtonLink href={`/admin/surveys/new?sheet=${sheet.id}`} variant="primary">
                  {t("start")}
                </ButtonLink>
              </>
            )}
            <Button variant="success" disabled={busy} onClick={() => void save()}>
              {t("save")}
            </Button>
          </div>
        </div>

        <Input
          label={t("title")}
          placeholder={t("title")}
          value={sheet.title}
          maxLength={200}
          onChange={(event) => edit((s) => ({ ...s, title: event.target.value }), "title")}
          error={error("title")}
        />

        <ol className="flex flex-col gap-6">
          {sheet.questions.map((question, index) => (
            <li key={question.id}>
              <QuestionCard
                question={question}
                number={index + 1}
                first={index === 0}
                last={index === sheet.questions.length - 1}
                only={sheet.questions.length === 1}
                error={error}
                onChange={(change, ...keys) => editQuestion(question.id, change, ...keys)}
                onMove={(by) => move(index, by)}
                onRemove={() => edit((s) => ({ ...s, questions: s.questions.filter((q) => q.id !== question.id) }))}
              />
            </li>
          ))}
        </ol>

        <div className="flex flex-col items-start gap-2">
          <Button
            variant="secondary"
            disabled={full}
            onClick={() => edit((s) => ({ ...s, questions: [...s.questions, blankQuestion(nextId(s.questions))] }))}
          >
            <Icon icon={Plus} weight="bold" />
            {t("addQuestion")}
          </Button>
          {full ? <p className="text-caption font-bold text-danger-text">{te("TOO_MANY_QUESTIONS", { max: MAX_QUESTIONS })}</p> : null}
        </div>
      </main>

      <ConfirmModal
        open={deleting}
        title={t("deleteTitle")}
        body={t("deleteBody", { title: sheet.title })}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        onConfirm={() => void remove()}
        onClose={() => setDeleting(false)}
      />
      {toast}
    </div>
  );
}

type QuestionCardProps = {
  question: SurveyQuestion;
  number: number;
  first: boolean;
  last: boolean;
  only: boolean;
  error: (key: string) => string | undefined;
  onChange: (change: (q: SurveyQuestion) => SurveyQuestion, ...keys: string[]) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
};

function QuestionCard({ question, number, first, last, only, error, onChange, onMove, onRemove }: QuestionCardProps) {
  const t = useTranslations("admin.surveys.editor");
  const te = useTranslations("admin.surveys.errors");
  const id = question.id;
  const heading = t("question", { number });

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-h3 font-bold">{heading}</h2>
        <IconButton label={`${t("moveUp")}: ${heading}`} title={t("moveUp")} disabled={first} onClick={() => onMove(-1)}>
          <Icon icon={ArrowUp} weight="bold" />
        </IconButton>
        <IconButton label={`${t("moveDown")}: ${heading}`} title={t("moveDown")} disabled={last} onClick={() => onMove(1)}>
          <Icon icon={ArrowDown} weight="bold" />
        </IconButton>
        <IconButton label={`${t("removeQuestion")}: ${heading}`} title={t("removeQuestion")} disabled={only} onClick={onRemove}>
          <Icon icon={Trash} weight="bold" />
        </IconButton>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <Select
          label={t("kind")}
          value={question.kind}
          wrapperClassName="w-full max-w-[280px]"
          onChange={(event) => onChange((q) => withKind(q, event.target.value as SurveyQuestionKind), `${id}:limit`)}
        >
          {KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`kinds.${kind}`)}
            </option>
          ))}
        </Select>
        <Checkbox
          label={t("required")}
          checked={question.required}
          onChange={(event) => onChange((q) => ({ ...q, required: event.target.checked }))}
        />
      </div>

      <Input
        label={t("text")}
        value={question.text}
        maxLength={500}
        onChange={(event) => onChange((q) => ({ ...q, text: event.target.value }), `${id}:text`)}
        error={error(`${id}:text`)}
      />

      {question.kind === "open" ? (
        <NumberField
          label={t("maxWords")}
          max={MAX_WORDS}
          value={question.maxWords}
          tooHigh={te("TOO_MANY_WORDS", { max: MAX_WORDS })}
          onChange={(words) => onChange((q) => (q.kind === "open" ? { ...q, maxWords: words } : q))}
        />
      ) : (
        <Choices question={question} error={error} onChange={onChange} />
      )}

      {question.kind === "multi" ? (
        <div className="flex flex-wrap items-start gap-4">
          <Select
            label={t("limit")}
            value={question.limit.mode}
            wrapperClassName="w-full max-w-[280px]"
            onChange={(event) =>
              onChange(
                (q) => (q.kind === "multi" ? { ...q, limit: withLimitMode(q.limit.n, event.target.value as SelectLimitMode) } : q),
                `${id}:limit`,
              )
            }
          >
            {LIMIT_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {t(`limits.${mode}`)}
              </option>
            ))}
          </Select>
          {question.limit.mode === "none" ? null : (
            <NumberField
              label={t("limitCount")}
              max={question.choices.length}
              value={question.limit.n ?? 1}
              tooHigh={te("LIMIT_TOO_HIGH", { max: question.choices.length })}
              error={error(`${id}:limit`) ? te("LIMIT_TOO_HIGH", { max: question.choices.length }) : undefined}
              onChange={(n) => onChange((q) => (q.kind === "multi" ? { ...q, limit: { ...q.limit, n } } : q), `${id}:limit`)}
            />
          )}
        </div>
      ) : null}
    </Card>
  );
}

/** A whole number from 1 to `max`. A higher one is not taken: it shows `tooHigh` until the field is fixed. */
function NumberField({
  label,
  max,
  value,
  tooHigh,
  error,
  onChange,
}: {
  label: string;
  max: number;
  value: number;
  tooHigh: string;
  error?: string;
  onChange: (value: number) => void;
}) {
  const [typed, setTyped] = useState(String(value));
  const n = Number(typed);
  const over = typed !== "" && Number.isInteger(n) && n > max;
  return (
    <Input
      label={label}
      type="number"
      inputMode="numeric"
      min={1}
      max={max}
      step={1}
      value={typed}
      wrapperClassName="w-full max-w-[200px]"
      onChange={(event) => {
        setTyped(event.target.value);
        const next = Number(event.target.value);
        if (event.target.value !== "" && Number.isInteger(next) && next >= 1 && next <= max) onChange(next);
      }}
      onBlur={() => {
        if (!over) setTyped(String(value));
      }}
      error={over ? tooHigh : error}
    />
  );
}

function Choices({
  question,
  error,
  onChange,
}: {
  question: Exclude<SurveyQuestion, { kind: "open" }>;
  error: (key: string) => string | undefined;
  onChange: QuestionCardProps["onChange"];
}) {
  const t = useTranslations("admin.surveys.editor");
  const te = useTranslations("admin.surveys.errors");
  const full = question.choices.length >= MAX_CHOICES;
  const setChoices = (change: (choices: string[]) => string[], ...keys: string[]) =>
    onChange((q) => (q.kind === "open" ? q : { ...q, choices: change(q.choices) }), ...keys);
  // Removing a choice shifts the ones after it, so their errors no longer fit: they clear.
  const after = (index: number) => question.choices.map((_, i) => `${question.id}:choice:${i + 1}`).slice(index);

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-body font-bold">{t("choices")}</legend>
      {question.choices.map((choice, index) => {
        const label = t("choice", { number: index + 1 });
        return (
          <div key={index} className="flex items-start gap-2">
            <Input
              label={label}
              hideLabel
              placeholder={label}
              value={choice}
              maxLength={200}
              wrapperClassName="min-w-0 flex-1"
              onChange={(event) =>
                setChoices((choices) => choices.map((c, i) => (i === index ? event.target.value : c)), `${question.id}:choice:${index + 1}`)
              }
              error={error(`${question.id}:choice:${index + 1}`)}
            />
            <IconButton
              label={`${t("removeChoice")}: ${label}`}
              title={t("removeChoice")}
              disabled={question.choices.length <= MIN_CHOICES}
              onClick={() => setChoices((choices) => choices.filter((_, i) => i !== index), ...after(index), `${question.id}:limit`)}
            >
              <Icon icon={Trash} weight="bold" />
            </IconButton>
          </div>
        );
      })}
      <div className="flex flex-col items-start gap-2">
        <Button variant="neutral" disabled={full} onClick={() => setChoices((choices) => [...choices, ""], `${question.id}:limit`)}>
          <Icon icon={Plus} weight="bold" />
          {t("addChoice")}
        </Button>
        {full ? <p className="text-caption font-bold text-danger-text">{te("TOO_MANY_CHOICES", { max: MAX_CHOICES })}</p> : null}
      </div>
    </fieldset>
  );
}
