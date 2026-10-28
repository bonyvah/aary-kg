import type { Exam, ExamSummary } from "@/types/exam";
import { apiFetch } from "./client";

/** What the editor sends: the server makes the id. */
export type ExamInput = Pick<Exam, "title" | "minutes" | "questions">;

export const listExams = () => apiFetch<ExamSummary[]>("/exams");

export const getExam = (id: string) => apiFetch<Exam>(`/exams/${id}`);

export const createExam = (input: ExamInput) => apiFetch<Exam>("/exams", { method: "POST", body: input });

export const updateExam = (id: string, input: ExamInput) =>
  apiFetch<Exam>(`/exams/${id}`, { method: "PUT", body: input });

export const deleteExam = (id: string) => apiFetch<void>(`/exams/${id}`, { method: "DELETE" });
