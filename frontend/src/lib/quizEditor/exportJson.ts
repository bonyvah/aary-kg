import type { BaseQuestion, QuizQuestion } from "@/types/quiz";

type Exported = {
  title: string;
  minutes?: number;
  questions: { text: string; answers: string[]; correct: number; seconds?: number; readSeconds?: number }[];
};

/**
 * A quiz or an exam sheet in the format the JSON import reads: blank answer slots left out and
 * `correct` counted among the answers that are kept. Quiz questions keep their times.
 */
export function toExportJson(doc: { title: string; minutes?: number; questions: readonly (BaseQuestion | QuizQuestion)[] }): Exported {
  return {
    title: doc.title,
    ...(doc.minutes !== undefined ? { minutes: doc.minutes } : {}),
    questions: doc.questions.map((q) => {
      const kept = q.answers.map((text, index) => ({ text: text.trim(), position: index + 1 })).filter((a) => a.text !== "");
      return {
        text: q.text,
        answers: kept.map((a) => a.text),
        correct: kept.findIndex((a) => a.position === q.correct) + 1,
        ...("seconds" in q ? { seconds: q.seconds, readSeconds: q.readSeconds } : {}),
      };
    }),
  };
}

/** A file name from the title: letters, digits and dashes. */
export function fileName(title: string): string {
  const base = title.trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `${base || "quiz"}.json`;
}

/** Saves a file in the browser. */
export function download(name: string, content: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJson(doc: Parameters<typeof toExportJson>[0]): void {
  download(fileName(doc.title), JSON.stringify(toExportJson(doc), null, 2), "application/json");
}
