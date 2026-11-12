"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle, LockSimple } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { Radio } from "@/components/ui/Radio";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/useToast";
import { ApiRequestError, toKnownCode } from "@/lib/api/client";
import { submitStudentSurvey } from "@/lib/api/studentSurveys";
import { maxChars } from "@/lib/surveyEditor";
import { issuesOf, toPayload, toggle, type AnswerIssue, type Draft } from "@/lib/surveyAnswer";
import type { StudentSurvey, SurveyQuestion } from "@/types/survey";
import { ConfirmModal } from "./ConfirmModal";
import { StaffMenu } from "./StaffMenu";
import { StaffShell } from "./StaffShell";

/** /student/surveys/<id>: answer every question and send it once. Nothing ties the answers to the student. */
export function SurveyTakingScreen({ survey: initial }: { survey: StudentSurvey }) {
  const t = useTranslations("student.survey");
  const tc = useTranslations("common");
  const { toast, show } = useToast();
  const [survey, setSurvey] = useState(initial);
  const [draft, setDraft] = useState<Draft>({});
  // After a first try to send, the empty mandatory questions and the too-short selections show too.
  const [tried, setTried] = useState(false);
  const [serverIssues, setServerIssues] = useState<ReadonlyMap<string, string>>(new Map());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const questions = survey.questions ?? [];
  const issues = issuesOf(questions, draft, tried);

  function change(id: string, value: Draft[string]) {
    setDraft((current) => ({ ...current, [id]: value }));
    if (serverIssues.has(id)) setServerIssues((current) => new Map([...current].filter(([k]) => k !== id)));
  }

  function trySend() {
    setTried(true);
    if (issuesOf(questions, draft, true).size === 0) setConfirming(true);
  }

  async function send() {
    setConfirming(false);
    setBusy(true);
    try {
      setSurvey(await submitStudentSurvey(survey.id, toPayload(questions, draft)));
    } catch (error) {
      if (error instanceof ApiRequestError && error.issues.length > 0) setServerIssues(new Map(error.issues.map((i) => [i.field, i.code])));
      show("danger", tc(`apiError.${toKnownCode(error)}`));
      // Closed or answered meanwhile: the page shows that instead.
      if (error instanceof ApiRequestError && (error.code === "SURVEY_CLOSED" || error.code === "SURVEY_ALREADY_ANSWERED"))
        setSurvey((s) => ({ ...s, questions: null, status: error.code === "SURVEY_CLOSED" ? "closed" : s.status, answered: error.code === "SURVEY_ALREADY_ANSWERED" || s.answered }));
    } finally {
      setBusy(false);
    }
  }

  const done = survey.answered || survey.status === "closed" || survey.questions === null;

  return (
    <StaffShell
      topRight={
        <div className="flex items-center gap-3">
          <ButtonLink href="/student" variant="neutral">
            {t("back")}
          </ButtonLink>
          <StaffMenu />
        </div>
      }
    >
      <h1 className="text-h1 font-black [overflow-wrap:anywhere]">{survey.title}</h1>
      {done ? (
        <EmptyState
          icon={survey.answered ? CheckCircle : LockSimple}
          title={survey.answered ? t("answered") : t("closed")}
        />
      ) : (
        <>
          <ol className="flex flex-col gap-6">
            {questions.map((question, index) => {
              const code = issues.get(question.id) ?? serverIssues.get(question.id);
              return (
                <li key={question.id}>
                  <QuestionField
                    question={question}
                    number={index + 1}
                    value={draft[question.id]}
                    issue={code as AnswerIssue | "ANSWER_INVALID" | undefined}
                    onChange={(value) => change(question.id, value)}
                  />
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap items-center gap-4 pb-4">
            <Button variant="success" size="lg" disabled={busy} onClick={trySend}>
              {t("send")}
            </Button>
            {tried && issues.size > 0 ? <p className="text-body font-bold text-danger-text">{t("fix")}</p> : null}
          </div>
        </>
      )}
      <ConfirmModal
        open={confirming}
        title={t("confirmTitle")}
        body={t("confirmBody")}
        confirmLabel={t("send")}
        cancelLabel={t("cancel")}
        variant="success"
        onConfirm={() => void send()}
        onClose={() => setConfirming(false)}
      />
      {toast}
    </StaffShell>
  );
}

type FieldProps = {
  question: SurveyQuestion;
  number: number;
  value: Draft[string] | undefined;
  issue: AnswerIssue | "ANSWER_INVALID" | undefined;
  onChange: (value: Draft[string]) => void;
};

function QuestionField({ question, number, value, issue, onChange }: FieldProps) {
  const t = useTranslations("student.survey");
  const titleId = `survey-q-${question.id}`;
  const errorId = `${titleId}-error`;
  // «n» is the number the message names: the min for too few, the max for too many.
  const n =
    question.kind === "multi" ? (issue === "TOO_FEW" ? question.limit.min : (question.limit.max ?? question.choices.length)) : 0;
  const error = issue
    ? t(`errors.${issue}`, { n, max: question.kind === "open" ? question.maxWords : 0 })
    : undefined;
  const picked = Array.isArray(value) ? value : [];

  return (
    <Card className="flex flex-col gap-4">
      <h2 id={titleId} className="text-h3 font-bold [overflow-wrap:anywhere]">
        {number}. {question.text}
        {question.required ? (
          <span className="text-danger-text" aria-label={t("required")} title={t("required")}>
            {" *"}
          </span>
        ) : null}
      </h2>
      {question.kind === "open" ? (
        <Textarea
          label={question.text}
          hideLabel
          rows={4}
          value={typeof value === "string" ? value : ""}
          // A little room over the limit, so the error shows instead of the typing stopping silently.
          maxLength={maxChars(question.maxWords) + 50}
          onChange={(event) => onChange(event.target.value)}
          error={error}
        />
      ) : (
        <div
          role={question.kind === "single" ? "radiogroup" : "group"}
          aria-labelledby={titleId}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          className="flex flex-col gap-1"
        >
          {question.choices.map((choice, index) =>
            question.kind === "single" ? (
              <Radio
                key={index}
                name={titleId}
                label={choice}
                checked={picked.includes(index + 1)}
                onChange={() => onChange(toggle(question, value, index + 1))}
              />
            ) : (
              <Checkbox key={index} label={choice} checked={picked.includes(index + 1)} onChange={() => onChange(toggle(question, value, index + 1))} />
            ),
          )}
          {error ? (
            <p id={errorId} className="text-caption font-bold text-danger-text">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </Card>
  );
}
