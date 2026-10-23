export type ExamSessionStatus = "open" | "closed";

/** Late is only recorded: the student gets the same time limit. Absent students see the exam but can't open it. */
export type Attendance = "present" | "late" | "absent";

export type AttendanceChange = { attendance: Attendance; lateMinutes: number | null };

export type SessionStudent = AttendanceChange & {
  studentId: string;
  name: string;
  groupName: string | null;
};

/** One run of an exam sheet for chosen students. Title, time limit and questions are copied from the sheet. */
export type ExamSession = {
  id: string;
  examId: string;
  title: string;
  minutes: number;
  questionCount: number;
  status: ExamSessionStatus;
  /** ISO date-times. */
  openedAt: string;
  closedAt: string | null;
  groups: { id: string; name: string }[];
  students: SessionStudent[];
};

export type ExamSessionSummary = Pick<ExamSession, "id" | "title" | "status" | "openedAt" | "closedAt"> & {
  groupNames: string[];
  studentCount: number;
  absentCount: number;
};

/** A student who can be given an exam. */
export type StudentChoice = { id: string; name: string; groupId: string | null; groupName: string | null };
