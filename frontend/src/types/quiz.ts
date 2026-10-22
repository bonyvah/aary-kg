import type { AnswerPosition } from "@/components/game/AnswerTile";

export type QuizStatus = "draft" | "ready";

/** Four answers, in the order of the answer shapes: triangle, diamond, circle, square. */
export type AnswerTexts = [string, string, string, string];

/** Written by the author of a quiz or an exam, so it is not translated. */
export type BaseQuestion = {
  id: string;
  text: string;
  answers: AnswerTexts;
  correct: AnswerPosition;
};

export type QuizQuestion = BaseQuestion & {
  /** Time to answer, in seconds. */
  seconds: number;
  /** Time to read the question and its answers before they open, in seconds (3 to 10). */
  readSeconds: number;
};

export type Quiz = {
  id: string;
  title: string;
  status: QuizStatus;
  questions: QuizQuestion[];
};

/** What the dashboard list needs: no questions. */
export type QuizSummary = Pick<Quiz, "id" | "title" | "status"> & { questionCount: number };
