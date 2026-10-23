import type { AnswerPosition } from "@/components/game/AnswerTile";
import type { Attendance, ExamSessionStatus } from "@/types/examSession";

/** A question as the student gets it: never the correct answer. Blank answers are slots not used. */
export type StudentQuestion = { id: string; text: string; answers: string[] };

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
  /** Only while the attempt runs. */
  questions: StudentQuestion[] | null;
};

export type ScreenSignal = "TAB_BLUR" | "WINDOW_BLUR" | "FULLSCREEN_EXIT" | "PASTE";
