import type { Quiz, QuizSummary } from "@/types/quiz";
import { apiFetch } from "./client";

/** What the editor sends: the server makes the id and the status. */
export type QuizInput = Pick<Quiz, "title" | "questions">;

export const listQuizzes = () => apiFetch<QuizSummary[]>("/quizzes");

export const getQuiz = (id: string) => apiFetch<Quiz>(`/quizzes/${id}`);

export const createQuiz = (input: QuizInput) => apiFetch<Quiz>("/quizzes", { method: "POST", body: input });

export const updateQuiz = (id: string, input: QuizInput) =>
  apiFetch<Quiz>(`/quizzes/${id}`, { method: "PUT", body: input });
