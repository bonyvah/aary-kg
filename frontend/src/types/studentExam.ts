import type { AnswerPosition } from "@/components/game/AnswerTile";
import type { Attendance, ExamSessionStatus } from "@/types/examSession";

/** A question as the student gets it: never the correct answer. Blank answers are slots not used. */
export type StudentQuestion = { id: string; text: string; answers: string[]; image?: string | null };

export type StudentAttempt = {
  state: "in_progress" | "submitted";
  startedAt: string;
  deadlineAt: string;
  submittedAt: string | null;
  /** From the server's clock when the response was made; the screen counts down from it. */
  secondsLeft: number;
  /** question id -> chosen position. Empty once the attempt ended. */
  answers: Record<string, AnswerPosition>;
};

/** Once the exam is closed: a question with its correct answer and the student's pick (null: none). */
export type ResultQuestion = StudentQuestion & {
  correct: AnswerPosition;
  chosen: AnswerPosition | null;
  /** False when the teacher's ruling took the question out. */
  counted: boolean;
};

export type StudentResult = {
  score: number;
  total: number;
  /** Empty in the list of exams. */
  questions: ResultQuestion[];
};

export type StudentExam = {
  id: string;
  title: string;
  minutes: number;
  questionCount: number;
  status: ExamSessionStatus;
  openedAt: string;
  closedAt: string | null;
  attendance: Attendance;
  attempt: StudentAttempt | null;
  /** Open, not absent, nothing running, and an attempt left (the first, or one the teacher gave). */
  canStart: boolean;
  /** Only while the attempt runs. */
  questions: StudentQuestion[] | null;
  /** Only once the exam is closed, for a student who took it. */
  result: StudentResult | null;
};

export type ScreenSignal = "TAB_BLUR" | "WINDOW_BLUR" | "FULLSCREEN_EXIT" | "PASTE";
