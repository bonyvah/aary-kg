import type { ResultQuestion, ScreenSignal } from "@/types/studentExam";

export type ExamSessionStatus = "open" | "closed";

/** Late is only recorded: the student gets the same time limit. Absent students see the exam but can't open it. */
export type Attendance = "present" | "late" | "absent";

export type AttendanceChange = { attendance: Attendance; lateMinutes: number | null };

/** none: not started; in_progress: the clock runs; submitted: ended (handed in, time up or the exam closed). */
export type AttemptState = "none" | "in_progress" | "submitted";

export type SessionStudent = AttendanceChange & {
  studentId: string;
  name: string;
  groupName: string | null;
  attemptState: AttemptState;
  startedAt: string | null;
  submittedAt: string | null;
  /** How the attempt ended: handed in, time up, or the exam's close. */
  submitReason: SubmitReason | null;
  /** After the anti-cheat ruling. `rawScore`: the correct answers alone. */
  score: number | null;
  rawScore: number | null;
  decision: Decision | null;
  /** Left the screen at least once (pasting alone doesn't count). */
  suspect: boolean;
  /** Screen signals during the attempt, only the kinds seen. */
  signals: { kind: ScreenSignal; count: number }[];
  /** Every attempt taken, inactive ones too. */
  attemptCount: number;
  /** The teacher may give one more attempt. */
  canGrant: boolean;
};

export type SubmitReason = "manual" | "timeout" | "closed";

/** The teacher's anti-cheat ruling: keep the score, zero it, or per question. */
export type Decision = "mercy" | "zero" | "individual";
/** Per question: keep its point, or it doesn't count. */
export type QuestionDecision = "mercy" | "skip";

export type DecisionInput = { decision: Decision; questions?: Record<string, QuestionDecision> };

type Ruling = { decision: Decision | null; questions: Record<string, QuestionDecision> };

/** What a teacher or an admin did: a ruling, one more attempt (allowed attempts before and after), an inactivated attempt. */
export type AuditEntry = { actorName: string; at: string } & (
  | { action: "decision"; before: Ruling; after: Ruling }
  | { action: "grant"; before: { attempts: number }; after: { attempts: number } }
  | { action: "inactivate"; before: { active: boolean }; after: { active: boolean } }
);

/** One attempt for the teacher (and admins): every answer and every signal. */
export type AttemptRecord = Pick<SessionStudent, "attemptState" | "startedAt" | "submittedAt" | "submitReason" | "score" | "rawScore" | "decision" | "suspect"> & {
  id: string;
  number: number;
  active: boolean;
  /** The latest active attempt: its score counts. */
  counts: boolean;
  questionDecisions: Record<string, QuestionDecision>;
  questions: ResultQuestion[];
  signals: { kind: ScreenSignal; questionId: string | null; at: string }[];
};

/** One student on an exam: every attempt, the first one first, and the log of what was done. */
export type AttemptDetail = {
  studentId: string;
  name: string;
  total: number;
  attempts: AttemptRecord[];
  history: AuditEntry[];
};

/** One run of an exam sheet for chosen students. Title, time limit and questions are copied from the sheet. */
export type ExamSession = {
  id: string;
  examId: string;
  ownerName: string;
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

export type ExamSessionSummary = Pick<ExamSession, "id" | "ownerName" | "title" | "status" | "openedAt" | "closedAt"> & {
  groupNames: string[];
  studentCount: number;
  absentCount: number;
};

/** A student who can be given an exam. */
export type StudentChoice = { id: string; name: string; groupId: string | null; groupName: string | null };
