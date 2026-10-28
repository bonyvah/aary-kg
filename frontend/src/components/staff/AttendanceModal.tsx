"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import type { AttendanceChange, StudentChoice } from "@/types/examSession";
import { AttendanceTable, type AttendanceRow } from "./AttendanceTable";

type AttendanceModalProps = {
  rows: readonly AttendanceRow[];
  disabled?: boolean;
  onChange: (studentId: string, change: AttendanceChange) => void;
  /** Students not on the exam yet who can be added, with what adds one. Left out: no adding. */
  addable?: readonly StudentChoice[];
  onAdd?: (studentId: string) => void;
  onClose: () => void;
};

/** Who is absent or late (and adding a student who isn't on the exam), in a dialog. */
export function AttendanceModal({ rows, disabled = false, onChange, addable = [], onAdd, onClose }: AttendanceModalProps) {
  const t = useTranslations("staff.examSession.attendance");
  const [adding, setAdding] = useState("");

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={t("title")}
      actions={
        <Button variant="neutral" onClick={onClose}>
          {t("done")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="max-h-[calc(100dvh-20rem)] overflow-y-auto">
          <AttendanceTable rows={rows} disabled={disabled} onChange={onChange} />
        </div>
        {onAdd && !disabled && addable.length > 0 ? (
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
                onAdd(adding);
                setAdding("");
              }}
            >
              {t("add")}
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

/** «Attendance», with how many are absent and late when any are. */
export function AttendanceButton({ rows, onClick }: { rows: readonly AttendanceRow[]; onClick: () => void }) {
  const t = useTranslations("staff.examSession.attendance");
  const absent = rows.filter((r) => r.attendance === "absent").length;
  const late = rows.filter((r) => r.attendance === "late").length;
  const parts = [t("title"), absent ? t("absentCount", { count: absent }) : null, late ? t("lateCount", { count: late }) : null];
  return (
    <Button variant="secondary" onClick={onClick}>
      {parts.filter(Boolean).join(" · ")}
    </Button>
  );
}
