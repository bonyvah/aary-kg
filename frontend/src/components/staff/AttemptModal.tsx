"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Cross } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/useToast";
import { toKnownCode } from "@/lib/api/client";
import { getAttemptDetail, inactivateAttempt } from "@/lib/api/examSessions";
import { useDateTime } from "@/lib/useDateTime";
import type { AttemptDetail, AttemptRecord, AuditEntry, ExamSession } from "@/types/examSession";
import { ConfirmModal } from "./ConfirmModal";
import { ResourceView, useResource } from "./Resource";
import { SubmitStateBadge } from "./SubmitStateBadge";

type AttemptModalProps = {
  sessionId: string;
  studentId: string;
  name: string;
  /** Admins may make an attempt inactive. */
  admin: boolean;
  onChanged: (session: ExamSession) => void;
  onClose: () => void;
};

/** A student's attempts: each question with their answer and the correct one, the screen signals, and the log. */
export function AttemptModal({ sessionId, studentId, name, admin, onChanged, onClose }: AttemptModalProps) {
  const t = useTranslations("staff.examSession.attempt");
  const tc = useTranslations("common");
  const { toast, show } = useToast();
  const resource = useResource(() => getAttemptDetail(sessionId, studentId));
  const [inactivating, setInactivating] = useState<AttemptRecord | null>(null);
  const [busy, setBusy] = useState(false);

  async function inactivate() {
    if (!inactivating) return;
    setBusy(true);
    try {
      onChanged(await inactivateAttempt(inactivating.id));
      void resource.reload();
      show("success", t("inactivated"));
    } catch (error) {
      show("danger", tc(`apiError.${toKnownCode(error)}`));
    } finally {
      setBusy(false);
      setInactivating(null);
    }
  }

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
        {(detail) => <AttemptBody detail={detail} admin={admin} onInactivate={setInactivating} />}
      </ResourceView>
      <ConfirmModal
        open={inactivating !== null}
        title={t("inactivate")}
        body={inactivating ? t("confirmInactivate", { number: inactivating.number }) : ""}
        confirmLabel={t("inactivate")}
        cancelLabel={t("cancel")}
        busy={busy}
        onConfirm={() => void inactivate()}
        onClose={() => setInactivating(null)}
      />
      {toast}
    </Modal>
  );
}

function AttemptBody({
  detail,
  admin,
  onInactivate,
}: {
  detail: AttemptDetail;
  admin: boolean;
  onInactivate: (attempt: AttemptRecord) => void;
}) {
  const t = useTranslations("staff.examSession.attempt");
  const many = detail.attempts.length > 1;

  return (
    <div className="flex flex-col gap-8">
      {[...detail.attempts].reverse().map((attempt) => (
        <section key={attempt.id} className="flex flex-col gap-4" aria-label={t("number", { number: attempt.number })}>
          {many || admin ? (
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-h3 font-black">{t("number", { number: attempt.number })}</h3>
              {attempt.counts ? <Badge variant="success">{t("counts")}</Badge> : null}
              {attempt.active ? null : <Badge variant="danger">{t("inactive")}</Badge>}
              {admin && attempt.active && attempt.attemptState === "submitted" ? (
                <Button variant="danger" onClick={() => onInactivate(attempt)}>
                  {t("inactivate")}
                </Button>
              ) : null}
            </div>
          ) : null}
          <AttemptView attempt={attempt} total={detail.total} />
        </section>
      ))}
      {detail.history.length > 0 ? <History entries={detail.history} /> : null}
    </div>
  );
}

function AttemptView({ attempt, total }: { attempt: AttemptRecord; total: number }) {
  const t = useTranslations("staff.examSession.attempt");
  const tf = useTranslations("admin.game.flagNames");
  const tr = useTranslations("staff.examSession.suspects");
  const dateTime = useDateTime();
  const time = (iso: string) => dateTime(new Date(iso));
  const loose = attempt.signals.filter((s) => !attempt.questions.some((q) => q.id === s.questionId));

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitStateBadge state={attempt.attemptState} reason={attempt.submitReason} />
        {attempt.score !== null ? (
          <span className="text-h2 font-black tabular-nums">{t("score", { score: attempt.score, total })}</span>
        ) : null}
        {attempt.decision ? <Badge variant="neutral">{tr(`ruling.${attempt.decision}`)}</Badge> : null}
        {attempt.startedAt ? (
          <span className="text-body text-ink-muted">
            {time(attempt.startedAt)}
            {attempt.submittedAt ? ` – ${time(attempt.submittedAt)}` : ""}
          </span>
        ) : null}
      </div>
      <ol className="flex flex-col gap-4">
        {attempt.questions.map((question, index) => {
          const chosen = question.chosen;
          const right = chosen === question.correct;
          const signals = attempt.signals.filter((s) => s.questionId === question.id);
          return (
            <li key={question.id} className="flex flex-col gap-2 rounded-md bg-surface-raised px-4 py-3">
              <p className="font-bold [overflow-wrap:anywhere]">
                <span className="tabular-nums">{index + 1}. </span>
                {question.text}
              </p>
              {question.counted ? null : (
                <div>
                  <Badge variant="danger">{t("notCounted")}</Badge>
                </div>
              )}
              {chosen === null ? (
                <p className="text-ink-muted">{t("unanswered")}</p>
              ) : (
                <p className={right ? "flex items-center gap-2 text-success-text" : "flex items-center gap-2 text-danger-text"}>
                  {right ? <Check width={20} height={20} aria-label={t("right")} /> : <Cross width={20} height={20} aria-label={t("wrong")} />}
                  <span className="font-bold [overflow-wrap:anywhere]">{question.answers[chosen - 1]}</span>
                </p>
              )}
              {right ? null : (
                <p className="[overflow-wrap:anywhere]">{t("correct", { answer: question.answers[question.correct - 1] ?? "" })}</p>
              )}
              {signals.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {signals.map((signal, i) => (
                    <li key={i}>
                      <Badge variant={signal.kind === "PASTE" ? "neutral" : "danger"}>
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
              <Badge variant={signal.kind === "PASTE" ? "neutral" : "danger"}>
                {tf(signal.kind)} · {time(signal.at)}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

function History({ entries }: { entries: readonly AuditEntry[] }) {
  const t = useTranslations("staff.examSession.attempt");
  const tr = useTranslations("staff.examSession.suspects");
  const dateTime = useDateTime();
  const ruling = (decision: string | null) => (decision ? tr(`ruling.${decision}`) : tr("unruled"));

  return (
    <section className="flex flex-col gap-2" aria-labelledby="exam-history">
      <h3 id="exam-history" className="text-h3 font-bold">
        {t("history")}
      </h3>
      <ul className="flex flex-col gap-1">
        {entries.map((entry, i) => (
          <li key={i} className="text-body">
            {dateTime(new Date(entry.at))} · {entry.actorName}:{" "}
            {entry.action === "decision"
              ? `${ruling(entry.before.decision)} → ${ruling(entry.after.decision)}`
              : entry.action === "grant"
                ? t("granted", { attempts: entry.after.attempts })
                : t("inactivatedEntry")}
          </li>
        ))}
      </ul>
    </section>
  );
}
