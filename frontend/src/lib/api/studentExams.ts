import type { AnswerPosition } from "@/components/game/AnswerTile";
import type { ScreenSignal, StudentExam } from "@/types/studentExam";
import { apiFetch } from "./client";

export const listStudentExams = () => apiFetch<StudentExam[]>("/student/exams");

export const getStudentExam = (id: string) => apiFetch<StudentExam>(`/student/exams/${id}`);

export const startStudentExam = (id: string) => apiFetch<StudentExam>(`/student/exams/${id}/start`, { method: "POST" });

export const saveAnswer = (id: string, questionId: string, answer: AnswerPosition | null) =>
  apiFetch<StudentExam>(`/student/exams/${id}/answers/${encodeURIComponent(questionId)}`, { method: "PUT", body: { answer } });

export const submitStudentExam = (id: string) => apiFetch<StudentExam>(`/student/exams/${id}/submit`, { method: "POST" });

export const sendSignal = (id: string, kind: ScreenSignal, questionId: string | null) =>
  apiFetch<void>(`/student/exams/${id}/signals`, { method: "POST", body: { kind, questionId } });
