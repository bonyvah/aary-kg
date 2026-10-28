import type { EditorDoc } from "./reducer";

/**
 * Quizzes and exam sheets being created, kept in this browser until each is saved or thrown away.
 * Any number of them: each has its own id, carried in the editor's address (`?draft=<id>`).
 */
export type DraftKind = "quiz" | "exam";

export type Draft<D extends EditorDoc = EditorDoc> = { id: string; doc: D; updatedAt: number };

const key = (kind: DraftKind) => `aary.drafts.${kind}`;
// Before there could be several: one draft per kind under this key. Picked up once, then removed.
const oldKey = (kind: DraftKind) => `aary.draft.${kind}`;

type Store = Record<string, { doc: EditorDoc; updatedAt: number }>;

const isDoc = (doc: unknown): doc is EditorDoc =>
  typeof doc === "object" && doc !== null && Array.isArray((doc as EditorDoc).questions) && (doc as EditorDoc).questions.length > 0;

function read(kind: DraftKind): Store {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key(kind)) ?? "{}");
    const store: Store = {};
    if (typeof parsed === "object" && parsed !== null) {
      for (const [id, entry] of Object.entries(parsed as Record<string, unknown>)) {
        const { doc, updatedAt } = (entry ?? {}) as { doc?: unknown; updatedAt?: unknown };
        if (isDoc(doc)) store[id] = { doc, updatedAt: typeof updatedAt === "number" ? updatedAt : 0 };
      }
    }
    const old = window.localStorage.getItem(oldKey(kind));
    if (old) {
      const doc: unknown = JSON.parse(old);
      if (isDoc(doc)) store[newDraftId()] = { doc, updatedAt: Date.now() };
      window.localStorage.removeItem(oldKey(kind));
      window.localStorage.setItem(key(kind), JSON.stringify(store));
    }
    return store;
  } catch {
    return {};
  }
}

function write(kind: DraftKind, store: Store): void {
  try {
    window.localStorage.setItem(key(kind), JSON.stringify(store));
  } catch {
    // Storage full or blocked: the work stays on the page, only not across a close.
  }
}

export function newDraftId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Every draft of this kind, the latest touched first. */
export function listDrafts<D extends EditorDoc>(kind: DraftKind): Draft<D>[] {
  return Object.entries(read(kind))
    .map(([id, entry]) => ({ id, doc: entry.doc as D, updatedAt: entry.updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function readDraft<D extends EditorDoc>(kind: DraftKind, id: string): D | null {
  return (read(kind)[id]?.doc as D | undefined) ?? null;
}

export function writeDraft(kind: DraftKind, id: string, doc: EditorDoc): void {
  write(kind, { ...read(kind), [id]: { doc, updatedAt: Date.now() } });
}

export function clearDraft(kind: DraftKind, id: string): void {
  const store = read(kind);
  delete store[id];
  write(kind, store);
}

/** Whether a draft says anything yet: a title, or a question with some text. */
export function hasContent(doc: EditorDoc): boolean {
  return doc.title.trim() !== "" || doc.questions.some((q) => q.text.trim() !== "" || q.answers.some((a) => a.trim() !== ""));
}
