"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { getAttemptDetail } from "@/lib/api/examSessions";
import { useDateTime } from "@/lib/useDateTime";
import type { AttemptDetail, QuestionDecision } from "@/types/examSession";
import { ResourceView, useResource } from "./Resource";

type IndividualRulingModalProps = {
  sessionId: string;
  studentId: string;
  name: string;
  busy: boolean;
  onSave: (questions: Record<string, QuestionDecision>) => void;
  onClose: () => void;
};

/** Each question the student left the screen on, its signals with their times, and mercy or «doesn't count». */
export function IndividualRulingModal({ sessionId, studentId, name, busy, onSave, onClose }: IndividualRulingModalProps) {
  const resource = useResource(() => getAttemptDetail(sessionId, studentId));
  return (
    <ResourceView resource={resource} inline>
      {(detail) => <RulingForm detail={detail} name={name} busy={busy} onSave={onSave} onClose={onClose} />}
    </ResourceView>
  );
}

function RulingForm({
  detail,
  name,
  busy,
  onSave,
  onClose,
}: { detail: AttemptDetail } & Pick<IndividualRulingModalProps, "name" | "busy" | "onSave" | "onClose">) {
  const t = useTranslations("staff.examSession.individual");
  const tf = useTranslations("admin.game.flagNames");
  const dateTime = useDateTime();
  const [choices, setChoices] = useState<Record<string, QuestionDecision>>(
    detail.decision === "individual" ? detail.questionDecisions : {},
  );
  const flagged = detail.questions
    .map((question, index) => ({ question, index, signals: detail.signals.filter((s) => s.questionId === question.id) }))
    .filter((row) => row.signals.length > 0);
  // Signals that came with no question (e.g. right after the start): then every question is offered.
  const rows = flagged.length > 0 ? flagged : detail.questions.map((question, index) => ({ question, index, signals: [] }));

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={t("title", { name })}
      actions={
        <>
          <Button variant="neutral" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button variant="success" disabled={busy} onClick={() => onSave(choices)}>
            {t("save")}
          </Button>
        </>
      }
    >
      <ol className="flex flex-col gap-4">
        {rows.map(({ question, index, signals }) => {
          const choice = choices[question.id] ?? "mercy";
          const pick = (value: QuestionDecision) => setChoices((current) => ({ ...current, [question.id]: value }));
          return (
            <li key={question.id} className="flex flex-col gap-3 rounded-md bg-surface-raised px-4 py-3">
              <p className="font-bold [overflow-wrap:anywhere]">
                <span className="tabular-nums">{index + 1}. </span>
                {question.text}
              </p>
              {signals.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {signals.map((signal, i) => (
                    <li key={i}>
                      <Badge variant={signal.kind === "PASTE" ? "neutral" : "danger"}>
                        {tf(signal.kind)} · {dateTime(new Date(signal.at))}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div role="radiogroup" aria-label={t("choice", { number: index + 1 })} className="flex flex-wrap gap-3">
                <Button role="radio" aria-checked={choice === "mercy"} variant={choice === "mercy" ? "success" : "neutral"} onClick={() => pick("mercy")}>
                  {t("mercy")}
                </Button>
                <Button role="radio" aria-checked={choice === "skip"} variant={choice === "skip" ? "danger" : "neutral"} onClick={() => pick("skip")}>
                  {t("skip")}
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
    </Modal>
  );
}
