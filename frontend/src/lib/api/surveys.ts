import type { Survey, SurveySheet, SurveySheetSummary, SurveySummary } from "@/types/survey";
import { apiFetch } from "./client";

/** What the editor sends: the server makes the id. */
export type SurveySheetInput = Pick<SurveySheet, "title" | "questions">;

export const listSurveySheets = () => apiFetch<SurveySheetSummary[]>("/admin/survey-sheets");

export const getSurveySheet = (id: string) => apiFetch<SurveySheet>(`/admin/survey-sheets/${id}`);

export const createSurveySheet = (input: SurveySheetInput) =>
  apiFetch<SurveySheet>("/admin/survey-sheets", { method: "POST", body: input });

export const updateSurveySheet = (id: string, input: SurveySheetInput) =>
  apiFetch<SurveySheet>(`/admin/survey-sheets/${id}`, { method: "PUT", body: input });

export const deleteSurveySheet = (id: string) => apiFetch<void>(`/admin/survey-sheets/${id}`, { method: "DELETE" });

export const listSurveys = () => apiFetch<SurveySummary[]>("/admin/surveys");

export const getSurvey = (id: string) => apiFetch<Survey>(`/admin/surveys/${id}`);

export const startSurvey = (input: { sheetId: string; groupIds: string[] }) =>
  apiFetch<Survey>("/admin/surveys", { method: "POST", body: input });

export const reopenSurvey = (id: string) => apiFetch<Survey>(`/admin/surveys/${id}/reopen`, { method: "POST" });

export const deleteSurvey = (id: string) => apiFetch<void>(`/admin/surveys/${id}`, { method: "DELETE" });

export const closeSurvey = (id: string) => apiFetch<Survey>(`/admin/surveys/${id}/close`, { method: "POST" });
