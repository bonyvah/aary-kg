import type { AnswerPosition } from "@/components/game/AnswerTile";
import type { AnswerTexts } from "@/types/quiz";
import { apiFetch } from "./client";

/** A question written from the material: blank answer slots at the end. */
export type GeneratedQuestion = { text: string; answers: AnswerTexts; correct: AnswerPosition };

export type GenerateInput = { files: readonly File[]; text: string; count: number; language: "ky" | "ru" };

/** All the files of one request together (the server checks the same). */
export const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 10;

/** Questions from a teacher's material. Nothing is saved: they go into the editor to review. */
export function generateQuestions({ files, text, count, language }: GenerateInput) {
  const form = new FormData();
  form.set("count", String(count));
  form.set("language", language);
  if (files.length > 0) for (const file of files) form.append("files", file);
  else form.set("text", text);
  return apiFetch<{ title: string; questions: GeneratedQuestion[] }>("/ai/questions", { method: "POST", body: form });
}
