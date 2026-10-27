import type { AttemptDetail, AttendanceChange, DecisionInput, ExamSession, ExamSessionSummary, StudentChoice } from "@/types/examSession";
import { apiFetch } from "./client";

export type ExamSessionInput = {
  examId: string;
  groupIds: string[];
  students: (AttendanceChange & { studentId: string })[];
};

export const listExamSessions = () => apiFetch<ExamSessionSummary[]>("/exam-sessions");

export const getExamSession = (id: string) => apiFetch<ExamSession>(`/exam-sessions/${id}`);

export const startExamSession = (input: ExamSessionInput) =>
  apiFetch<ExamSession>("/exam-sessions", { method: "POST", body: input });

export const setAttendance = (id: string, studentId: string, change: AttendanceChange) =>
  apiFetch<ExamSession>(`/exam-sessions/${id}/students/${studentId}`, { method: "PUT", body: change });

export const closeExamSession = (id: string) => apiFetch<ExamSession>(`/exam-sessions/${id}/close`, { method: "POST" });

export const listStudents = () => apiFetch<StudentChoice[]>("/users/students");

export const getAttemptDetail = (id: string, studentId: string) =>
  apiFetch<AttemptDetail>(`/exam-sessions/${id}/students/${studentId}`);

/** For admins: every exam. */
export const listAllExamSessions = () => apiFetch<ExamSessionSummary[]>("/admin/exam-sessions");

export const decide = (id: string, studentId: string, input: DecisionInput) =>
  apiFetch<ExamSession>(`/exam-sessions/${id}/students/${studentId}/decision`, { method: "PUT", body: input });

export const grantAttempt = (id: string, studentId: string) =>
  apiFetch<ExamSession>(`/exam-sessions/${id}/students/${studentId}/grant`, { method: "POST" });

/** Admins only: kept and shown, no longer counted. */
export const inactivateAttempt = (attemptId: string) =>
  apiFetch<ExamSession>(`/admin/exam-attempts/${attemptId}/inactivate`, { method: "POST" });
