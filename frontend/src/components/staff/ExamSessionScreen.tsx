"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ListChecks } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/useToast";
import { toKnownCode } from "@/lib/api/client";
import { closeExamSession, decide, setAttendance } from "@/lib/api/examSessions";
import { PRESENT } from "@/lib/examSessions";
import { useDateTime } from "@/lib/useDateTime";
import type { AttendanceChange, DecisionInput, ExamSession, StudentChoice } from "@/types/examSession";
import { AttemptModal } from "./AttemptModal";
import { IndividualRulingModal } from "./IndividualRulingModal";
import { SuspectsPanel } from "./SuspectsPanel";
import { AttendanceTable } from "./AttendanceTable";
import { ConfirmModal } from "./ConfirmModal";
import { ExamSessionStatusBadge } from "./ExamSessionStatusBadge";
import { StaffMenu } from "./StaffMenu";
import { StaffShell } from "./StaffShell";
import { SubmitStateBadge } from "./SubmitStateBadge";
import { useCurrentUser, useHomePath } from "./SessionProvider";

type ExamSessionScreenProps = {
  session: ExamSession;
  /** Every active student, to add one who isn't on the exam yet. */
  students: StudentChoice[];
};

/** One exam: its state, who takes it and how they did, attendance (editable while open), and «close».
 * Admins read it only. */
export function ExamSessionScreen({ session: initial, students }: ExamSessionScreenProps) {
  const t = useTranslations("staff.examSession.page");
  const ta = useTranslations("staff.examSession.attendance");
  const tf = useTranslations("admin.game.flagNames");
  const home = useHomePath();
  const readOnly = useCurrentUser().role === "admin";
  const [viewing, setViewing] = useState<{ studentId: string; name: string } | null>(null);
  const [ruling, setRuling] = useState<{ studentId: string; name: string } | null>(null);
  const tc = useTranslations("common");
  const dateTime = useDateTime();
  const { toast, show } = useToast();
  const [session, setSession] = useState(initial);
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState("");
  const open = session.status === "open";
  const editable = open && !readOnly;
  const byId = new Map(session.students.map((s) => [s.studentId, s]));
  const onExam = new Set(session.students.map((s) => s.studentId));
  const addable = students.filter((s) => !onExam.has(s.id));

  async function change(studentId: string, attendance: AttendanceChange) {
    try {
      setSession(await setAttendance(session.id, studentId, attendance));
    } catch (error) {
      show("danger", tc(`apiError.${toKnownCode(error)}`));
    }
  }

  async function rule(studentId: string, input: DecisionInput) {
    setBusy(true);
    try {
      setSession(await decide(session.id, studentId, input));
      setRuling(null);
      show("success", t("ruled"));
    } catch (error) {
      show("danger", tc(`apiError.${toKnownCode(error)}`));
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    setBusy(true);
    try {
      setSession(await closeExamSession(session.id));
      show("success", t("closed"));
    } catch (error) {
      show("danger", tc(`apiError.${toKnownCode(error)}`));
    } finally {
      setBusy(false);
      setClosing(false);
    }
  }

  return (
    <StaffShell
      topRight={
        <div className="flex items-center gap-3">
          <ButtonLink href={home} variant="neutral">
            {t("back")}
          </ButtonLink>
          <StaffMenu />
        </div>
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <ExamSessionStatusBadge status={session.status} />
          </div>
          <h1 className="text-h1 font-black [overflow-wrap:anywhere]">{session.title}</h1>
          {session.groups.length > 0 ? (
            <p className="text-body-lg font-bold [overflow-wrap:anywhere]">{session.groups.map((g) => g.name).join(", ")}</p>
          ) : null}
          {readOnly ? <p className="text-body font-bold">{t("teacher", { name: session.ownerName })}</p> : null}
          <p className="text-body text-ink-muted">
            {t("meta", { count: session.questionCount, minutes: session.minutes })} · {dateTime(new Date(session.openedAt))}
            {session.closedAt ? ` – ${dateTime(new Date(session.closedAt))}` : ""}
          </p>
        </div>
        {editable ? (
          <Button variant="danger" onClick={() => setClosing(true)}>
            {t("close")}
          </Button>
        ) : null}
      </div>

      <SuspectsPanel
        students={session.students}
        readOnly={readOnly}
        onDecide={(student, decision) => void rule(student.studentId, { decision })}
        onIndividual={(student) => setRuling(student)}
      />

      <AttendanceTable
        rows={session.students}
        disabled={!editable}
        onChange={(id, attendance) => void change(id, attendance)}
        extra={{
          headers: [ta("state"), ta("score"), ta("signals"), ta("answers")],
          cells: (studentId) => {
            const row = byId.get(studentId);
            if (!row) return [];
            return [
              <SubmitStateBadge key="state" state={row.attemptState} reason={row.submitReason} />,
              <span key="score" className="font-black tabular-nums">
                {row.score === null ? "" : ta("scoreValue", { score: row.score, total: session.questionCount })}
              </span>,
              <span key="signals" className="flex flex-wrap gap-1">
                {row.signals.map((signal) => (
                  <Badge key={signal.kind} variant={signal.kind === "PASTE" ? "neutral" : "danger"}>
                    {tf(signal.kind)}: {signal.count}
                  </Badge>
                ))}
              </span>,
              row.attemptState === "none" ? null : (
                <Button
                  key="answers"
                  variant="secondary"
                  aria-label={ta("answersFor", { name: row.name })}
                  title={ta("answersFor", { name: row.name })}
                  onClick={() => setViewing(row)}
                >
                  <Icon icon={ListChecks} weight="bold" />
                </Button>
              ),
            ];
          },
        }}
      />

      {editable && addable.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3">
          <Select label={t("addStudent")} wrapperClassName="w-full max-w-[360px]" value={adding} onChange={(event) => setAdding(event.target.value)}>
            <option value="">{t("addPick")}</option>
            {addable.map((student) => (
              <option key={student.id} value={student.id}>
                {student.groupName ? `${student.name} · ${student.groupName}` : student.name}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            disabled={adding === ""}
            onClick={() => {
              void change(adding, PRESENT);
              setAdding("");
            }}
          >
            {t("add")}
          </Button>
        </div>
      ) : null}

      {ruling ? (
        <IndividualRulingModal
          sessionId={session.id}
          studentId={ruling.studentId}
          name={ruling.name}
          busy={busy}
          onSave={(questions) => void rule(ruling.studentId, { decision: "individual", questions })}
          onClose={() => setRuling(null)}
        />
      ) : null}
      {viewing ? (
        <AttemptModal sessionId={session.id} studentId={viewing.studentId} name={viewing.name} onClose={() => setViewing(null)} />
      ) : null}
      <ConfirmModal
        open={closing}
        title={t("confirmClose.title")}
        body={t("confirmClose.body")}
        confirmLabel={t("close")}
        cancelLabel={t("cancel")}
        busy={busy}
        onConfirm={() => void close()}
        onClose={() => setClosing(false)}
      />
      {toast}
    </StaffShell>
  );
}
