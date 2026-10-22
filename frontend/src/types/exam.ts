import type { BaseQuestion } from "@/types/quiz";

/** An exam question has no time of its own: the whole exam has one time limit. */
export type ExamQuestion = BaseQuestion;

/** A reusable quiz-like test. Students take it through an exam session, which copies the questions. */
export type Exam = {
  id: string;
  title: string;
  /** The time limit of the whole exam, in minutes. */
  minutes: number;
  questions: ExamQuestion[];
};

/** What the dashboard list needs: no questions. */
export type ExamSummary = Pick<Exam, "id" | "title" | "minutes"> & { questionCount: number };
