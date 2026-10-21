import type { AnswerPosition } from "@/components/game/AnswerTile";
import type { AnswerTexts, QuizQuestion } from "@/types/quiz";
import {
  DEFAULT_READ_SECONDS,
  DEFAULT_SECONDS,
  MAX_READ_SECONDS,
  MAX_SECONDS,
  MIN_READ_SECONDS,
  MIN_SECONDS,
} from "@/lib/quizEditor/reducer";

/** The server's limits (backend/app/schemas/quiz.py). */
export const MAX_QUESTIONS = 100;
export const MAX_TITLE_LENGTH = 200;
export const MAX_TEXT_LENGTH = 500;
export const MAX_ANSWER_LENGTH = 200;
const MIN_ANSWERS = 2;
const ANSWER_SLOTS = 4;

/** A question from the pasted JSON, before the editor gives it an id. */
export type ImportedQuestion = Omit<QuizQuestion, "id">;

/** `question` is 1-based and `room` is the questions left, for the message. Codes are translated under `staff.editor.import.errors`. */
export type ImportError = { code: ImportErrorCode; question?: number; room?: number };
export type ImportErrorCode =
  | "NOT_JSON"
  | "NO_QUESTIONS"
  | "TOO_MANY_QUESTIONS"
  | "TITLE_INVALID"
  | "QUESTION_INVALID"
  | "TEXT_MISSING"
  | "TEXT_TOO_LONG"
  | "ANSWERS_COUNT"
  | "ANSWER_INVALID"
  | "ANSWER_TOO_LONG"
  | "CORRECT_INVALID"
  | "SECONDS_INVALID"
  | "READ_SECONDS_INVALID";

export type ImportResult =
  | { ok: true; title: string | null; questions: ImportedQuestion[] }
  | { ok: false; errors: ImportError[] };

/** Chat replies wrap the JSON in ``` fences or a sentence: keep what is between the outer braces. */
function extractJson(raw: string): unknown {
  const text = raw.trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.search(/[[{]/);
    const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
    if (start === -1 || end <= start) return undefined;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function parseQuestion(value: unknown, question: number, errors: ImportError[]): ImportedQuestion | null {
  const fail = (code: ImportErrorCode) => {
    errors.push({ code, question });
    return null;
  };
  if (!isRecord(value)) return fail("QUESTION_INVALID");

  const text = typeof value.text === "string" ? value.text.trim() : "";
  if (text === "") return fail("TEXT_MISSING");
  if (text.length > MAX_TEXT_LENGTH) return fail("TEXT_TOO_LONG");

  const answers = value.answers;
  if (!Array.isArray(answers) || answers.length < MIN_ANSWERS || answers.length > ANSWER_SLOTS) {
    return fail("ANSWERS_COUNT");
  }
  if (!answers.every((answer) => typeof answer === "string" && answer.trim() !== "")) return fail("ANSWER_INVALID");
  const trimmed = answers.map((answer: string) => answer.trim());
  if (trimmed.some((answer) => answer.length > MAX_ANSWER_LENGTH)) return fail("ANSWER_TOO_LONG");

  const correct = value.correct;
  if (typeof correct !== "number" || !Number.isInteger(correct) || correct < 1 || correct > trimmed.length) {
    return fail("CORRECT_INVALID");
  }

  const seconds = value.seconds ?? DEFAULT_SECONDS;
  if (typeof seconds !== "number" || !Number.isInteger(seconds) || seconds < MIN_SECONDS || seconds > MAX_SECONDS) {
    return fail("SECONDS_INVALID");
  }

  const readSeconds = value.readSeconds ?? DEFAULT_READ_SECONDS;
  if (
    typeof readSeconds !== "number" ||
    !Number.isInteger(readSeconds) ||
    readSeconds < MIN_READ_SECONDS ||
    readSeconds > MAX_READ_SECONDS
  ) {
    return fail("READ_SECONDS_INVALID");
  }

  // A question with two or three answers leaves the last tiles empty, as the editor does.
  const padded = [...trimmed, "", "", ""].slice(0, ANSWER_SLOTS) as AnswerTexts;
  return { text, answers: padded, correct: correct as AnswerPosition, seconds, readSeconds };
}

/**
 * Reads quiz JSON pasted from a chat: `{ title?, questions: [{ text, answers, correct, seconds?, readSeconds? }] }`,
 * or the questions array alone. `room` is how many questions the quiz can still take.
 * All or nothing: one bad question and nothing is imported.
 */
export function parseQuizJson(raw: string, room: number): ImportResult {
  const data = extractJson(raw);
  if (data === undefined) return { ok: false, errors: [{ code: "NOT_JSON" }] };

  const list = Array.isArray(data) ? data : isRecord(data) ? data.questions : undefined;
  if (!Array.isArray(list) || list.length === 0) return { ok: false, errors: [{ code: "NO_QUESTIONS" }] };

  const errors: ImportError[] = [];
  let title: string | null = null;
  if (isRecord(data) && data.title !== undefined) {
    if (typeof data.title !== "string" || data.title.trim().length > MAX_TITLE_LENGTH) {
      errors.push({ code: "TITLE_INVALID" });
    } else {
      title = data.title.trim() || null;
    }
  }
  if (list.length > room) errors.push({ code: "TOO_MANY_QUESTIONS", room });

  const questions: ImportedQuestion[] = [];
  list.forEach((value, index) => {
    const question = parseQuestion(value, index + 1, errors);
    if (question) questions.push(question);
  });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, title, questions };
}
