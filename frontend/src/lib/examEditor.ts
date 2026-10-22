import { NEW_QUIZ_ID } from "@/lib/quizEditor/reducer";
import type { Exam } from "@/types/exam";

/** The server's limits (backend/app/schemas/exam.py). */
export const MINUTES_OPTIONS = [15, 30, 45, 60] as const;
export const DEFAULT_MINUTES = 30;
export const MIN_MINUTES = 5;
export const MAX_MINUTES = 180;

/** A new, empty exam: one blank question so the editor has something to edit. */
export function blankExam(): Exam {
  return {
    id: NEW_QUIZ_ID,
    title: "",
    minutes: DEFAULT_MINUTES,
    questions: [{ id: "question-1", text: "", answers: ["", "", "", ""], correct: 1 }],
  };
}
