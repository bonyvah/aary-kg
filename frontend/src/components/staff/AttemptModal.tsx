"use client";

import { useTranslations } from "next-intl";
import { Check, Cross } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { getAttemptDetail } from "@/lib/api/examSessions";
import { useDateTime } from "@/lib/useDateTime";
import type { AttemptDetail } from "@/types/examSession";
import { ResourceView, useResource } from "./Resource";
import { SubmitStateBadge } from "./SubmitStateBadge";

type AttemptModalProps = {
  sessionId: string;
  studentId: string;
  name: string;
  onClose: () => void;
};

/** One student's attempt: each question with their answer and the correct one, and the screen signals on it. */
export function AttemptModal({ sessionId, studentId, name, onClose }: AttemptModalProps) {
  const t = useTranslations("staff.examSession.attempt");
  const resource = useResource(() => getAttemptDetail(sessionId, studentId));

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={name}
      actions={
        <Button variant="neutral" onClick={onClose}>
          {t("close")}
        </Button>
      }
    >
      <ResourceView resource={resource} inline>
        {(detail) => <AttemptBody detail={detail} />}
      </ResourceView>
    </Modal>
  );
}

function AttemptBody({ detail }: { detail: AttemptDetail }) {
  const t = useTranslations("staff.examSession.attempt");
  const tf = useTranslations("admin.game.flagNames");
  const dateTime = useDateTime();
  const time = (iso: string) => dateTime(new Date(iso));
  const loose = detail.signals.filter((s) => !detail.questions.some((q) => q.id === s.questionId));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <SubmitStateBadge state={detail.attemptState} reason={detail.submitReason} />
        {detail.score !== null ? (
          <span className="text-h2 font-black tabular-nums">{t("score", { score: detail.score, total: detail.total })}</span>
        ) : null}
        {detail.startedAt ? (
          <span className="text-body text-ink-muted">
            {time(detail.startedAt)}
            {detail.submittedAt ? ` – ${time(detail.submittedAt)}` : ""}
          </span>
        ) : null}
      </div>
      <ol className="flex flex-col gap-4">
        {detail.questions.map((question, index) => {
          const chosen = question.chosen;
          const right = chosen === question.correct;
          const signals = detail.signals.filter((s) => s.questionId === question.id);
          return (
            <li key={question.id} className="flex flex-col gap-2 rounded-md bg-surface-raised px-4 py-3">
              <p className="font-bold [overflow-wrap:anywhere]">
                <span className="tabular-nums">{index + 1}. </span>
                {question.text}
              </p>
              {chosen === null ? (
                <p className="text-ink-muted">{t("unanswered")}</p>
              ) : (
                <p className={right ? "flex items-center gap-2 text-success-text" : "flex items-center gap-2 text-danger-text"}>
                  {right ? <Check width={20} height={20} aria-label={t("right")} /> : <Cross width={20} height={20} aria-label={t("wrong")} />}
                  <span className="font-bold [overflow-wrap:anywhere]">{question.answers[chosen - 1]}</span>
                </p>
              )}
              {right ? null : (
                <p className="[overflow-wrap:anywhere]">
                  {t("correct", { answer: question.answers[question.correct - 1] ?? "" })}
                </p>
              )}
              {signals.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {signals.map((signal, i) => (
                    <li key={i}>
                      <Badge variant="danger">
                        {tf(signal.kind)} · {time(signal.at)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
      {loose.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label={t("otherSignals")}>
          {loose.map((signal, i) => (
            <li key={i}>
              <Badge variant="danger">
                {tf(signal.kind)} · {time(signal.at)}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
