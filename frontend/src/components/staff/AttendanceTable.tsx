"use client";

import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dropdown } from "@/components/ui/Dropdown";
import { Table, Td, Th } from "@/components/ui/Table";
import { LATE_OPTIONS, MAX_LATE_MINUTES, MIN_LATE_MINUTES, toggle } from "@/lib/examSessions";
import type { AttendanceChange } from "@/types/examSession";

export type AttendanceRow = AttendanceChange & { studentId: string; name: string; groupName: string | null };

type AttendanceTableProps = {
  rows: readonly AttendanceRow[];
  onChange: (studentId: string, change: AttendanceChange) => void;
  disabled?: boolean;
};

/** One row per student: absent and late are ticked, everyone else is present. Late takes a number of minutes. */
export function AttendanceTable({ rows, onChange, disabled = false }: AttendanceTableProps) {
  const t = useTranslations("staff.examSession.attendance");

  return (
    <Table>
      <thead>
        <tr>
          <Th>{t("student")}</Th>
          <Th>{t("group")}</Th>
          <Th>{t("absent")}</Th>
          <Th>{t("late")}</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const minutes = row.lateMinutes ?? LATE_OPTIONS[0];
          const options = Array.from(new Set([...LATE_OPTIONS, minutes]))
            .sort((a, b) => a - b)
            .map((value) => ({ value, label: String(value) }));
          const late = (lateMinutes: number) => onChange(row.studentId, { attendance: "late", lateMinutes });
          return (
            <tr key={row.studentId}>
              <Td className="font-bold [overflow-wrap:anywhere]">{row.name}</Td>
              <Td className="text-ink-muted">{row.groupName ?? ""}</Td>
              <Td className="py-1">
                <Checkbox
                  hideLabel
                  label={t("absentFor", { name: row.name })}
                  checked={row.attendance === "absent"}
                  disabled={disabled}
                  onChange={() => onChange(row.studentId, toggle(row, "absent"))}
                />
              </Td>
              <Td className="py-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    hideLabel
                    label={t("lateFor", { name: row.name })}
                    checked={row.attendance === "late"}
                    disabled={disabled}
                    onChange={() => onChange(row.studentId, toggle(row, "late"))}
                  />
                  {row.attendance === "late" && disabled ? (
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
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
