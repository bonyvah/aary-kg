import type { SurveyQuestion, SurveyQuestionKind, SurveySheet } from "@/types/survey";

/** The server's limits (backend/app/schemas/survey.py). */
export const MIN_CHOICES = 2;
export const MAX_CHOICES = 30;
export const MAX_QUESTIONS = 100;
export const MAX_WORDS = 100;
export const CHARS_PER_WORD = 6;
export const MAX_OPEN_CHARS = 650;
export const NEW_SHEET_ID = "new";

export const KINDS: readonly SurveyQuestionKind[] = ["single", "multi", "open"];

/** The characters an open answer may have: words of 6 characters, never over 650. */
export function maxChars(maxWords: number): number {
  return Math.min(maxWords * CHARS_PER_WORD, MAX_OPEN_CHARS);
}

/** An id not used yet in the sheet. */
export function nextId(questions: readonly SurveyQuestion[]): string {
  const used = new Set(questions.map((q) => q.id));
  let n = questions.length + 1;
  while (used.has(`q${n}`)) n += 1;
  return `q${n}`;
}

export function blankQuestion(id: string, kind: SurveyQuestionKind = "single"): SurveyQuestion {
  if (kind === "open") return { id, kind, text: "", required: true, maxWords: MAX_WORDS };
  if (kind === "multi") return { id, kind, text: "", required: true, choices: ["", ""], limit: { min: 1, max: null } };
  return { id, kind, text: "", required: true, choices: ["", ""] };
}

export function blankSheet(): SurveySheet {
  return { id: NEW_SHEET_ID, title: "", questions: [blankQuestion("q1")] };
}

/** The question as another kind: the text and «required» stay, and the choices between single and multiple. */
export function withKind(question: SurveyQuestion, kind: SurveyQuestionKind): SurveyQuestion {
  if (question.kind === kind) return question;
  const next = blankQuestion(question.id, kind);
  const kept = { ...next, text: question.text, required: question.required };
  if (kept.kind !== "open" && question.kind !== "open") return { ...kept, choices: [...question.choices] };
  return kept;
}

/** Error code per editor key, the same keys and codes as the server: title, <id>:text, <id>:choice:<n>, <id>:limit. */
export function findIssues(sheet: Pick<SurveySheet, "title" | "questions">): Map<string, string> {
  const issues = new Map<string, string>();
  if (!sheet.title.trim()) issues.set("title", "FIELD_REQUIRED");
  for (const q of sheet.questions) {
    if (!q.text.trim()) issues.set(`${q.id}:text`, "FIELD_REQUIRED");
    if (q.kind === "open") continue;
    q.choices.forEach((choice, index) => {
      if (!choice.trim()) issues.set(`${q.id}:choice:${index + 1}`, "FIELD_REQUIRED");
    });
    if (q.kind === "multi") {
      const top = q.limit.max ?? q.choices.length;
      if (q.limit.min > q.choices.length || top > q.choices.length) issues.set(`${q.id}:limit`, "LIMIT_TOO_HIGH");
      else if (q.limit.min > top) issues.set(`${q.id}:limit`, "LIMIT_RANGE");
    }
  }
  return issues;
}

/** What is sent: trimmed title, everything else as typed (the server trims nothing else). */
export function toInput(sheet: SurveySheet): Pick<SurveySheet, "title" | "questions"> {
  return { title: sheet.title.trim(), questions: sheet.questions };
}
