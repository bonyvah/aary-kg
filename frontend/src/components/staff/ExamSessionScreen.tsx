"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/useToast";
import { toKnownCode } from "@/lib/api/client";
import { closeExamSession, setAttendance } from "@/lib/api/examSessions";
import { PRESENT } from "@/lib/examSessions";
import { useDateTime } from "@/lib/useDateTime";
import type { AttendanceChange, ExamSession, StudentChoice } from "@/types/examSession";
import { AttendanceTable } from "./AttendanceTable";
import { ConfirmModal } from "./ConfirmModal";
import { ExamSessionStatusBadge } from "./ExamSessionStatusBadge";
import { StaffMenu } from "./StaffMenu";
import { StaffShell } from "./StaffShell";

type ExamSessionScreenProps = {
  session: ExamSession;
  /** Every active student, to add one who isn't on the exam yet. */
  students: StudentChoice[];
};

/** One exam: its state, who takes it, attendance (editable while open), and «close». */
export function ExamSessionScreen({ session: initial, students }: ExamSessionScreenProps) {
  const t = useTranslations("staff.examSession.page");
  const tc = useTranslations("common");
  const dateTime = useDateTime();
  const { toast, show } = useToast();
  const [session, setSession] = useState(initial);
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState("");
  const open = session.status === "open";
  const onExam = new Set(session.students.map((s) => s.studentId));
  const addable = students.filter((s) => !onExam.has(s.id));

  async function change(studentId: string, attendance: AttendanceChange) {
    try {
      setSession(await setAttendance(session.id, studentId, attendance));
    } catch (error) {
      show("danger", tc(`apiError.${toKnownCode(error)}`));
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
          <ButtonLink href="/dashboard" variant="neutral">
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
          <p className="text-body text-ink-muted">
            {t("meta", { count: session.questionCount, minutes: session.minutes })} · {dateTime(new Date(session.openedAt))}
            {session.closedAt ? ` – ${dateTime(new Date(session.closedAt))}` : ""}
          </p>
        </div>
        {open ? (
          <Button variant="danger" onClick={() => setClosing(true)}>
            {t("close")}
          </Button>
        ) : null}
      </div>

      <AttendanceTable rows={session.students} disabled={!open} onChange={(id, attendance) => void change(id, attendance)} />

      {open && addable.length > 0 ? (
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
