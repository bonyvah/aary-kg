"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/useToast";
import { toKnownCode } from "@/lib/api/client";
import { closeSurvey } from "@/lib/api/surveys";
import { useDateTime } from "@/lib/useDateTime";
import type { QuestionResult, Survey, SurveyStudent } from "@/types/survey";
import { ConfirmModal } from "./ConfirmModal";
import { useCurrentUser } from "./SessionProvider";
import { StaffMenu } from "./StaffMenu";
import { StaffShell } from "./StaffShell";
import { SurveyStatusBadge } from "./SurveyStatusBadge";

/** A survey's results: how many answered, each choice counted, the open answers. Admins close it. */
export function SurveyResultsScreen({ survey: initial }: { survey: Survey }) {
  const t = useTranslations("admin.surveys.results");
  const tc = useTranslations("common");
  const format = useFormatter();
  const dateTime = useDateTime();
  const { toast, show } = useToast();
  const canClose = useCurrentUser().role === "admin";
  const [survey, setSurvey] = useState(initial);
  const [closing, setClosing] = useState(false);
  const [who, setWho] = useState(false);
  const [busy, setBusy] = useState(false);

  async function close() {
    setClosing(false);
    setBusy(true);
    try {
      setSurvey(await closeSurvey(survey.id));
    } catch (error) {
      show("danger", tc(`apiError.${toKnownCode(error)}`));
    } finally {
      setBusy(false);
    }
  }

  return (
    <StaffShell
      topRight={
        <div className="flex items-center gap-3">
          <ButtonLink href="/admin" variant="neutral">
            {t("back")}
          </ButtonLink>
          <StaffMenu />
        </div>
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <SurveyStatusBadge status={survey.status} />
            {survey.groupNames.map((name) => (
              <Badge key={name} variant="neutral">
                {name}
              </Badge>
            ))}
          </div>
          <h1 className="text-h1 font-black [overflow-wrap:anywhere]">{survey.title}</h1>
          <p className="text-body text-ink-muted">
            {dateTime(new Date(survey.openedAt))}
            {survey.closedAt ? ` – ${dateTime(new Date(survey.closedAt))}` : ""}
          </p>
        </div>
        {canClose && survey.status === "open" ? (
          <Button variant="danger" disabled={busy} onClick={() => setClosing(true)}>
            {t("close")}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <p className="text-h2 font-black tabular-nums">
          {t("answered", { answered: format.number(survey.answeredCount), total: format.number(survey.studentCount) })}
        </p>
        <Button variant="neutral" onClick={() => setWho(true)}>
          {t("who")}
        </Button>
      </div>

      <ol className="flex flex-col gap-6 pb-4">
        {survey.results.map((result, index) => (
          <li key={result.question.id}>
            <ResultCard result={result} number={index + 1} />
          </li>
        ))}
      </ol>

      <Modal
        open={who}
        onClose={() => setWho(false)}
        title={t("who")}
        wide
        actions={
          <Button variant="neutral" onClick={() => setWho(false)}>
            {t("closeDialog")}
          </Button>
        }
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <StudentList title={t("whoDone")} students={survey.students.filter((s) => s.answered)} empty={t("whoNobody")} />
          <StudentList title={t("whoPending")} students={survey.students.filter((s) => !s.answered)} empty={t("whoNobody")} />
        </div>
      </Modal>

      <ConfirmModal
        open={closing}
        title={t("closeTitle")}
        body={t("closeBody")}
        confirmLabel={t("close")}
        cancelLabel={t("cancel")}
        onConfirm={() => void close()}
        onClose={() => setClosing(false)}
      />
      {toast}
    </StaffShell>
  );
}

// Characters the preview of open answers may hold in all: three short answers, or fewer long ones.
const PREVIEW_CHARS = 600;
const PREVIEW_COUNT = 3;

/** The first few answers (fewer when they are long), and a button for a dialog with all of them. */
function OpenAnswers({ texts, title }: { texts: readonly string[]; title: string }) {
  const t = useTranslations("admin.surveys.results");
  const [all, setAll] = useState(false);
  if (texts.length === 0) return null;
  const preview: string[] = [];
  let used = 0;
  for (const text of texts) {
    if (preview.length >= PREVIEW_COUNT || (preview.length > 0 && used + text.length > PREVIEW_CHARS)) break;
    preview.push(text);
    used += text.length;
  }
  return (
    <>
      <AnswerList texts={preview} />
      {texts.length > preview.length ? (
        <div>
          <Button variant="neutral" onClick={() => setAll(true)}>
            {t("allAnswers", { count: texts.length })}
          </Button>
        </div>
      ) : null}
      <Modal
        open={all}
        onClose={() => setAll(false)}
        title={title}
        wide
        actions={
          <Button variant="neutral" onClick={() => setAll(false)}>
            {t("closeDialog")}
          </Button>
        }
      >
        <AnswerList texts={texts} scroll />
      </Modal>
    </>
  );
}

function AnswerList({ texts, scroll = false }: { texts: readonly string[]; scroll?: boolean }) {
  return (
    <ul className={scroll ? "flex max-h-[60dvh] flex-col gap-2 overflow-y-auto" : "flex flex-col gap-2"}>
      {texts.map((text, index) => (
        <li key={index} className="rounded-md bg-surface px-4 py-3 text-body whitespace-pre-wrap [overflow-wrap:anywhere]">
          {text}
        </li>
      ))}
    </ul>
  );
}

function ResultCard({ result, number }: { result: QuestionResult; number: number }) {
  const t = useTranslations("admin.surveys.results");
  const tk = useTranslations("admin.surveys.editor.kinds");
  const format = useFormatter();
  const { question } = result;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">{tk(question.kind)}</Badge>
        <span className="text-body text-ink-muted tabular-nums">{t("questionAnswered", { count: result.answered })}</span>
      </div>
      <h2 className="text-h3 font-bold [overflow-wrap:anywhere]">
        {number}. {question.text}
      </h2>
      {question.kind === "open" ? (
        <OpenAnswers texts={result.texts ?? []} title={`${number}. ${question.text}`} />
      ) : (
        <ul className="flex flex-col gap-3">
          {question.choices.map((choice, index) => {
            const count = result.counts?.[index] ?? 0;
            const share = result.answered > 0 ? count / result.answered : 0;
            const barVars = { "--pct": `${share * 100}%` } as CSSProperties;
            return (
              <li key={index} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 text-body-lg font-bold [overflow-wrap:anywhere]">{choice}</span>
                  <span className="text-body font-bold whitespace-nowrap tabular-nums">
                    {format.number(count)} · {format.number(share, { style: "percent", maximumFractionDigits: 0 })}
                  </span>
                </div>
                <span className="h-4 overflow-hidden rounded-full bg-surface">
                  <span style={barVars} className="block h-full w-(--pct) rounded-full bg-accent" />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function StudentList({ title, students, empty }: { title: string; students: readonly SurveyStudent[]; empty: string }) {
  const format = useFormatter();
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-body-lg font-black">
        {title} <span className="tabular-nums text-ink-muted">{format.number(students.length)}</span>
      </h3>
      {students.length === 0 ? (
        <p className="text-body text-ink-muted">{empty}</p>
      ) : (
        <ul className="flex max-h-[50dvh] flex-col gap-1 overflow-y-auto">
          {students.map((student) => (
            <li key={student.id} className="text-body [overflow-wrap:anywhere]">
              <span className="font-bold">{student.name}</span>
              {student.groupName ? <span className="text-ink-muted"> · {student.groupName}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
