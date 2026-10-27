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
};

export type SubmitReason = "manual" | "timeout" | "closed";

/** The teacher's anti-cheat ruling: keep the score, zero it, or per question. */
export type Decision = "mercy" | "zero" | "individual";
/** Per question: keep its point, or it doesn't count. */
export type QuestionDecision = "mercy" | "skip";

export type DecisionInput = { decision: Decision; questions?: Record<string, QuestionDecision> };

export type AuditEntry = {
  actorName: string;
  at: string;
  action: string;
  before: { decision: Decision | null; questions: Record<string, QuestionDecision> } | null;
  after: { decision: Decision | null; questions: Record<string, QuestionDecision> } | null;
};

/** One student's attempt for the teacher (and admins): every answer and every signal. */
export type AttemptDetail = Pick<SessionStudent, "studentId" | "name" | "attemptState" | "startedAt" | "submittedAt" | "submitReason" | "score" | "rawScore" | "decision" | "suspect"> & {
  questionDecisions: Record<string, QuestionDecision>;
  history: AuditEntry[];
  total: number;
  questions: ResultQuestion[];
  signals: { kind: ScreenSignal; questionId: string | null; at: string }[];
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
