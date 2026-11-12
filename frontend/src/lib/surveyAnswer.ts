import { maxChars } from "@/lib/surveyEditor";
import type { SurveyAnswer, SurveyQuestion } from "@/types/survey";

/** What a student has picked or typed so far: choice numbers (one for a single choice) or text. */
export type Draft = Readonly<Record<string, readonly number[] | string>>;

/** The rules the server checks (backend/app/services/survey_answers.py), with its codes. */
export type AnswerIssue = "ANSWER_REQUIRED" | "TOO_FEW" | "TOO_MANY" | "TOO_LONG";

function given(question: SurveyQuestion, value: Draft[string] | undefined): boolean {
  if (value === undefined) return false;
  return typeof value === "string" ? value.trim() !== "" : value.length > 0;
}

/**
 * What is wrong with the answer as it stands. `submitting`: also what only matters on sending
 * (a mandatory question left empty, too few choices); without it, only a limit already passed.
 */
export function issueOf(question: SurveyQuestion, value: Draft[string] | undefined, submitting: boolean): AnswerIssue | null {
  if (question.kind === "open") {
    const text = typeof value === "string" ? value.trim() : "";
    if (text.length > maxChars(question.maxWords)) return "TOO_LONG";
  } else if (question.kind === "multi" && Array.isArray(value)) {
    const { min, max } = question.limit;
    if (value.length > (max ?? question.choices.length)) return "TOO_MANY";
    if (submitting && value.length > 0 && value.length < min) return "TOO_FEW";
  }
  if (submitting && question.required && !given(question, value)) return "ANSWER_REQUIRED";
  return null;
}

/** Question id -> issue, for every question with one. */
export function issuesOf(questions: readonly SurveyQuestion[], draft: Draft, submitting: boolean): Map<string, AnswerIssue> {
  const issues = new Map<string, AnswerIssue>();
  for (const q of questions) {
    const issue = issueOf(q, draft[q.id], submitting);
    if (issue) issues.set(q.id, issue);
  }
  return issues;
}

/** One click on a choice: a single choice takes it, a multiple select adds or removes it (in order). */
export function toggle(question: SurveyQuestion, value: Draft[string] | undefined, choice: number): readonly number[] {
  const picked = Array.isArray(value) ? value : [];
  if (question.kind === "single") return [choice];
  return picked.includes(choice) ? picked.filter((c) => c !== choice) : [...picked, choice].sort((a, b) => a - b);
}

/** What is sent: only answered questions, a single choice as its number, texts trimmed. */
export function toPayload(questions: readonly SurveyQuestion[], draft: Draft): Record<string, SurveyAnswer> {
  const payload: Record<string, SurveyAnswer> = {};
  for (const q of questions) {
    const value = draft[q.id];
    if (!given(q, value) || value === undefined) continue;
    if (typeof value === "string") payload[q.id] = value.trim();
    else payload[q.id] = q.kind === "single" ? (value[0] as number) : [...value];
  }
  return payload;
}
