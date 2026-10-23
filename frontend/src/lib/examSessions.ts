import type { AttendanceChange, StudentChoice } from "@/types/examSession";

/** How late a student is, in minutes. Only recorded (backend/app/schemas/exam_session.py). */
export const LATE_OPTIONS = [5, 10, 15, 20] as const;
export const DEFAULT_LATE_MINUTES = 5;
export const MIN_LATE_MINUTES = 1;
export const MAX_LATE_MINUTES = 180;

export const PRESENT: AttendanceChange = { attendance: "present", lateMinutes: null };

/**
 * Who takes the exam: everyone in the picked groups plus the students picked one by one, each once,
 * sorted by name in the screen's language.
 */
export function targetStudents(
  all: readonly StudentChoice[],
  groupIds: ReadonlySet<string>,
  extraIds: ReadonlySet<string>,
  locale: string,
): StudentChoice[] {
  return all
    .filter((s) => (s.groupId !== null && groupIds.has(s.groupId)) || extraIds.has(s.id))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

/** Ticking «absent» or «late» turns the other off; unticking goes back to present. */
export function toggle(current: AttendanceChange, mark: "absent" | "late"): AttendanceChange {
  if (current.attendance === mark) return PRESENT;
  return mark === "late" ? { attendance: "late", lateMinutes: DEFAULT_LATE_MINUTES } : { attendance: "absent", lateMinutes: null };
}
