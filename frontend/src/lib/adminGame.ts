import type { DetailQuestion, GameEdit } from "@/types/adminGame";

/** Message key (under `admin.game.log`) and values for one line of the edit log. */
export type EditLine = { key: string; values: Record<string, string | number> };

const num = (value: unknown): number => (typeof value === "number" ? value : 0);
const text = (value: unknown): string => (typeof value === "string" ? value : "");

function after(value: unknown): { correct: boolean; points: number } {
  const entry = (value ?? {}) as { correct?: unknown; points?: unknown };
  return { correct: entry.correct === true, points: num(entry.points) };
}

/** What to say about one correction. Pure, so the wording stays in the message files. */
export function describeEdit(edit: GameEdit, questions: readonly DetailQuestion[]): EditLine {
  const nickname = edit.nickname ?? "";
  const { detail } = edit;
  switch (edit.action) {
    case "adjust_score":
      return { key: "adjust_score", values: { nickname, delta: num(detail.delta), after: num(detail.after) } };
    case "set_score":
      return { key: "set_score", values: { nickname, before: num(detail.before), after: num(detail.after) } };
    case "edit_answer": {
      const index = questions.findIndex((question) => question.id === text(detail.question));
      const result = after(detail.after);
      return {
        key: result.correct ? "edit_answer_right" : "edit_answer_wrong",
        values: { nickname, number: index + 1, points: result.points },
      };
    }
    case "rename_player":
      return { key: "rename_player", values: { before: text(detail.before), after: text(detail.after) } };
    case "remove_player":
      return { key: "remove_player", values: { nickname } };
    case "clear_flag":
      return { key: "clear_flag", values: { nickname, kind: text(detail.kind) } };
  }
}

/** A whole number typed into a field, or null when it isn't one («12», «-5», «+3»). */
export function parseWhole(value: string): number | null {
  const clean = value.trim();
  if (!/^[+-]?\d{1,9}$/.test(clean)) return null;
  return Number(clean);
}
