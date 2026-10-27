"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dropdown } from "@/components/ui/Dropdown";
import { Table, Td, Th } from "@/components/ui/Table";
import { LATE_OPTIONS, MAX_LATE_MINUTES, MIN_LATE_MINUTES, toggle } from "@/lib/examSessions";
import type { AttemptState, AttendanceChange } from "@/types/examSession";

export type AttendanceRow = AttendanceChange & {
  studentId: string;
  name: string;
  groupName: string | null;
  /** On a running exam: whether the student started. A started student's attendance stays. */
  attemptState?: AttemptState;
};

type AttendanceTableProps = {
  rows: readonly AttendanceRow[];
  onChange: (studentId: string, change: AttendanceChange) => void;
  disabled?: boolean;
  /** More columns after attendance: their headers, and the cells of one row. */
  extra?: { headers: readonly string[]; cells: (studentId: string) => ReactNode[] };
};

/** One row per student: absent and late are ticked, everyone else is present. Late takes a number of minutes. */
export function AttendanceTable({ rows, onChange, disabled = false, extra }: AttendanceTableProps) {
  const t = useTranslations("staff.examSession.attendance");

  return (
    <Table>
      <thead>
        <tr>
          <Th>{t("student")}</Th>
          <Th>{t("group")}</Th>
          <Th>{t("absent")}</Th>
          <Th>{t("late")}</Th>
          {extra?.headers.map((header) => <Th key={header}>{header}</Th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const minutes = row.lateMinutes ?? LATE_OPTIONS[0];
          const options = Array.from(new Set([...LATE_OPTIONS, minutes]))
            .sort((a, b) => a - b)
            .map((value) => ({ value, label: String(value) }));
          const late = (lateMinutes: number) => onChange(row.studentId, { attendance: "late", lateMinutes });
          const locked = disabled || (row.attemptState !== undefined && row.attemptState !== "none");
          return (
            <tr key={row.studentId}>
              <Td className="font-bold [overflow-wrap:anywhere]">{row.name}</Td>
              <Td className="text-ink-muted">{row.groupName ?? ""}</Td>
              <Td className="py-1">
                <Checkbox
                  hideLabel
                  label={t("absentFor", { name: row.name })}
                  checked={row.attendance === "absent"}
                  disabled={locked}
                  onChange={() => onChange(row.studentId, toggle(row, "absent"))}
                />
              </Td>
              <Td className="py-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    hideLabel
                    label={t("lateFor", { name: row.name })}
                    checked={row.attendance === "late"}
                    disabled={locked}
                    onChange={() => onChange(row.studentId, toggle(row, "late"))}
                  />
                  {row.attendance === "late" && locked ? (
                    <span className="font-bold">{t("minutesOption", { minutes })}</span>
                  ) : row.attendance === "late" ? (
                    <Dropdown
                      hideLabel
                      label={t("lateMinutesFor", { name: row.name })}
                      wrapperClassName="w-[140px]"
                      value={minutes}
                      options={options}
                      selectedLabel={t("minutesOption", { minutes })}
                      onChange={late}
                      custom={{ label: t("customMinutes"), min: MIN_LATE_MINUTES, max: MAX_LATE_MINUTES, onCommit: late }}
                    />
                  ) : null}
                </div>
              </Td>
              {extra?.cells(row.studentId).map((cell, index) => <Td key={index}>{cell}</Td>)}
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
