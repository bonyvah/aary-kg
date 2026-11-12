import type { StudentSurvey, SurveyAnswer } from "@/types/survey";
import { apiFetch } from "./client";

export const listStudentSurveys = () => apiFetch<StudentSurvey[]>("/student/surveys");

export const getStudentSurvey = (id: string) => apiFetch<StudentSurvey>(`/student/surveys/${id}`);

/** All answers at once, once. Refused per question with SURVEY_ANSWER_INVALID. */
export const submitStudentSurvey = (id: string, answers: Record<string, SurveyAnswer>) =>
  apiFetch<StudentSurvey>(`/student/surveys/${id}/submit`, { method: "POST", body: { answers } });
