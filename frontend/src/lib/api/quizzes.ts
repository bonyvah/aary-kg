import type { Quiz, QuizSummary } from "@/types/quiz";
import { apiFetch } from "./client";

/** What the editor sends: the server makes the id and the status. */
export type QuizInput = Pick<Quiz, "title" | "image" | "questions">;

export const listQuizzes = () => apiFetch<QuizSummary[]>("/quizzes");

export const getQuiz = (id: string) => apiFetch<Quiz>(`/quizzes/${id}`);

export const createQuiz = (input: QuizInput) => apiFetch<Quiz>("/quizzes", { method: "POST", body: input });

export const updateQuiz = (id: string, input: QuizInput) =>
  apiFetch<Quiz>(`/quizzes/${id}`, { method: "PUT", body: input });

/** Another teacher's quiz in the library. */
export type LibraryQuizSummary = {
  id: string;
  title: string;
  image: string | null;
  questionCount: number;
  ownerName: string;
  updatedAt: string;
};
export type LibraryQuiz = Pick<Quiz, "id" | "title" | "image" | "questions"> & { ownerName: string };

export const listLibrary = () => apiFetch<LibraryQuizSummary[]>("/quiz-library");

export const getLibraryQuiz = (id: string) => apiFetch<LibraryQuiz>(`/quiz-library/${id}`);

/** A copy among one's own quizzes. */
export const copyLibraryQuiz = (id: string) => apiFetch<Quiz>(`/quiz-library/${id}/copy`, { method: "POST" });

export const deleteQuiz = (id: string) => apiFetch<void>(`/quizzes/${id}`, { method: "DELETE" });
