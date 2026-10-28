import type { EditorDoc } from "./reducer";

/** A quiz or an exam sheet being created, kept in this browser until it is saved or thrown away. */
export type DraftKind = "quiz" | "exam";

const key = (kind: DraftKind) => `aary.draft.${kind}`;

export function readDraft<D extends EditorDoc>(kind: DraftKind): D | null {
  try {
    const raw = window.localStorage.getItem(key(kind));
    if (!raw) return null;
    const doc = JSON.parse(raw) as D;
    return typeof doc === "object" && doc && Array.isArray(doc.questions) && doc.questions.length > 0 ? doc : null;
  } catch {
    return null;
  }
}

export function writeDraft(kind: DraftKind, doc: EditorDoc): void {
  try {
    window.localStorage.setItem(key(kind), JSON.stringify(doc));
  } catch {
    // Storage full or blocked: the work stays on the page, only not across a close.
  }
}

export function clearDraft(kind: DraftKind): void {
  try {
    window.localStorage.removeItem(key(kind));
  } catch {
    // Nothing to clear.
  }
}

/** Whether a draft says anything yet: a title, or a question with some text. */
export function hasContent(doc: EditorDoc): boolean {
  return doc.title.trim() !== "" || doc.questions.some((q) => q.text.trim() !== "" || q.answers.some((a) => a.trim() !== ""));
}
