"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Decision, SessionStudent } from "@/types/examSession";
import { ConfirmModal } from "./ConfirmModal";

type SuspectsPanelProps = {
  students: readonly SessionStudent[];
  /** Admins see the rulings, they don't make them. */
  readOnly: boolean;
  onDecide: (student: SessionStudent, decision: "mercy" | "zero") => void;
  onIndividual: (student: SessionStudent) => void;
};

/** Students who left their screen, what the browser reported, and the ruling (changeable any time). */
export function SuspectsPanel({ students, readOnly, onDecide, onIndividual }: SuspectsPanelProps) {
  const t = useTranslations("staff.examSession.suspects");
  const tf = useTranslations("staff.report.flags");
  const [pending, setPending] = useState<{ student: SessionStudent; decision: "mercy" | "zero" } | null>(null);
  const suspects = students.filter((s) => s.suspect);
  if (suspects.length === 0) return null;

  const ruled = (decision: Decision | null) => (decision ? <Badge variant="neutral">{t(`ruling.${decision}`)}</Badge> : <Badge variant="danger">{t("unruled")}</Badge>);

  return (
    <section aria-labelledby="suspects-title" className="flex flex-col gap-4">
      <h2 id="suspects-title" className="text-h2 font-black">
        {t("title")}
      </h2>
      <ul className="flex flex-col gap-4">
        {suspects.map((student) => {
          const ended = student.attemptState === "submitted";
          return (
            <li key={student.studentId} className="flex flex-col gap-3 rounded-lg bg-surface-raised p-4">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-h3 font-bold [overflow-wrap:anywhere]">{student.name}</p>
                {ended ? ruled(student.decision) : null}
                {student.score !== null ? (
                  <span className="font-black tabular-nums">{t("score", { score: student.score, raw: student.rawScore ?? 0 })}</span>
                ) : null}
              </div>
              <ul className="list-disc pl-6 text-body-lg">
                {student.signals.map((signal) => (
                  <li key={signal.kind}>{tf(signal.kind, { count: signal.count })}</li>
                ))}
              </ul>
              {readOnly || !ended ? null : (
                <div className="flex flex-wrap gap-3">
                  <Button variant="success" disabled={student.decision === "mercy"} onClick={() => setPending({ student, decision: "mercy" })}>
                    {t("actions.mercy")}
                  </Button>
                  <Button variant="danger" disabled={student.decision === "zero"} onClick={() => setPending({ student, decision: "zero" })}>
                    {t("actions.zero")}
                  </Button>
                  <Button variant="secondary" onClick={() => onIndividual(student)}>
                    {t("actions.individual")}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <ConfirmModal
        open={pending !== null}
        title={pending ? t(`actions.${pending.decision}`) : ""}
        body={pending ? t(`confirm.${pending.decision}`, { name: pending.student.name }) : ""}
        confirmLabel={pending ? t(`actions.${pending.decision}`) : ""}
        cancelLabel={t("cancel")}
        variant={pending?.decision === "mercy" ? "success" : "danger"}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending) onDecide(pending.student, pending.decision);
          setPending(null);
        }}
      />
    </section>
  );
}
