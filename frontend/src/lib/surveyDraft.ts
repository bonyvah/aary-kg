import type { SurveySheet } from "@/types/survey";

/**
 * A survey sheet being written, kept in this browser until it is saved, so a refresh or a closed tab
 * loses nothing. One draft per sheet: under its id, or under the «new» id for a sheet not saved yet.
 */
const key = (id: string) => `aary.surveySheetDraft.${id}`;

type Doc = Pick<SurveySheet, "title" | "questions">;

const isDoc = (doc: unknown): doc is Doc => {
  if (typeof doc !== "object" || doc === null) return false;
  const { title, questions } = doc as Partial<Doc>;
  return (
    typeof title === "string" &&
    Array.isArray(questions) &&
    questions.length > 0 &&
    questions.every((q) => typeof q === "object" && q !== null && typeof q.id === "string" && typeof q.text === "string")
  );
};

export function readSurveyDraft(id: string): Doc | null {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key(id)) ?? "null");
    return isDoc(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSurveyDraft(id: string, doc: Doc): void {
  try {
    window.localStorage.setItem(key(id), JSON.stringify({ title: doc.title, questions: doc.questions }));
  } catch {
    // Storage full or blocked: the work stays on the page, only not across a refresh.
  }
}

export function clearSurveyDraft(id: string): void {
  try {
    window.localStorage.removeItem(key(id));
  } catch {
    // Storage blocked: nothing to clear.
  }
}
