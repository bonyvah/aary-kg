import type { Draft } from "@/lib/surveyAnswer";

/**
 * A student's answers, typed but not sent yet, kept in this browser so a refresh loses nothing.
 * One per student and survey; dropped once sent.
 */
const key = (studentId: string, surveyId: string) => `aary.surveyProgress.${studentId}.${surveyId}`;

const isDraft = (value: unknown): value is Draft =>
  typeof value === "object" &&
  value !== null &&
  Object.values(value).every((v) => typeof v === "string" || (Array.isArray(v) && v.every((n) => typeof n === "number")));

export function readProgress(studentId: string, surveyId: string): Draft | null {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key(studentId, surveyId)) ?? "null");
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeProgress(studentId: string, surveyId: string, draft: Draft): void {
  try {
    window.localStorage.setItem(key(studentId, surveyId), JSON.stringify(draft));
  } catch {
    // Storage full or blocked: the answers stay on the page, only not across a refresh.
  }
}

export function clearProgress(studentId: string, surveyId: string): void {
  try {
    window.localStorage.removeItem(key(studentId, surveyId));
  } catch {
    // Storage blocked: nothing to clear.
  }
}
