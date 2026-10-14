import type { AnswerPosition } from "@/components/game/AnswerTile";

export type QuizStatus = "draft" | "ready";

/** Four answers, in the order of the answer shapes: triangle, diamond, circle, square. */
export type AnswerTexts = [string, string, string, string];

/** Written by the quiz author, so it is not translated. */
export type QuizQuestion = {
  id: string;
  text: string;
  answers: AnswerTexts;
  correct: AnswerPosition;
  /** Time to answer, in seconds. */
  seconds: number;
};

export type Quiz = {
  id: string;
  title: string;
  status: QuizStatus;
  questions: QuizQuestion[];
};

/** What the dashboard list needs: no questions. */
export type QuizSummary = Pick<Quiz, "id" | "title" | "status"> & { questionCount: number };
