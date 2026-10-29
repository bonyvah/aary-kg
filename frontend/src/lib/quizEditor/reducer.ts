import type { AnswerPosition } from "@/components/game/AnswerTile";
import type { BaseQuestion, Quiz } from "@/types/quiz";

export const SECONDS_OPTIONS = [10, 20, 30, 60] as const;
export const DEFAULT_SECONDS = 20;
export const MIN_SECONDS = 5;
export const MAX_SECONDS = 300;
export const READ_SECONDS_OPTIONS = [3, 5, 10] as const;
export const DEFAULT_READ_SECONDS = 3;
export const MIN_READ_SECONDS = 3;
export const MAX_READ_SECONDS = 10;
/** A question needs its text and at least this many filled answers before the next one is added. */
export const MIN_FILLED_ANSWERS = 2;

/** What the editor edits: a quiz, or an exam (one time limit, no time per question). */
export type EditorDoc = { id: string; title: string; image?: string | null; questions: BaseQuestion[] };
type QuestionOf<D extends EditorDoc> = D["questions"][number];

export type EditorState<D extends EditorDoc = Quiz> = {
  doc: D;
  selectedId: string;
  /** Counter for new question ids. */
  nextNumber: number;
  /** Keys of the fields that failed the last save: `title`, `<id>:text`, `<id>:answer:<position>`. */
  errors: ReadonlySet<string>;
  /** The last save result, so the screen can show a toast. «failed»: the server could not be reached or said no. */
  saveResult: "saved" | "invalid" | "failed" | null;
  /** The error code behind a «failed» save. */
  failedCode: string | null;
};

export type EditorEvent<D extends EditorDoc = Quiz> =
  | { type: "TITLE_CHANGED"; title: string }
  /** Fields of the whole document besides the title, e.g. an exam's time limit. */
  | { type: "DOC_CHANGED"; change: Partial<Omit<D, "id" | "title" | "questions">> }
  | { type: "QUESTION_SELECTED"; id: string }
  | { type: "QUESTION_TEXT_CHANGED"; text: string }
  | { type: "ANSWER_TEXT_CHANGED"; position: AnswerPosition; text: string }
  | { type: "CORRECT_CHANGED"; position: AnswerPosition }
  /** A question's image: an uploaded image's id, or null to take it away. By id: an upload can end after another question was opened. */
  | { type: "QUESTION_IMAGE_CHANGED"; id: string; image: string | null }
  /** Fields of the selected question besides its text and answers, e.g. a quiz question's times. */
  | { type: "QUESTION_CHANGED"; change: Partial<Omit<QuestionOf<D>, "id" | "text" | "answers">> }
  | { type: "QUESTION_ADDED" }
  | { type: "QUESTION_REMOVED"; id: string }
  /** Drag and drop (or the move buttons): the question goes to this place in the list, 0-based. */
  | { type: "QUESTION_MOVED"; id: string; to: number }
  /** Start over from another document, e.g. a fresh one when a draft is thrown away. */
  | { type: "DOC_REPLACED"; doc: D }
  /** Questions from pasted JSON, added at the end. The title is used only while the quiz has none. */
  | { type: "QUESTIONS_IMPORTED"; title: string | null; questions: Omit<QuestionOf<D>, "id">[] }
  /** Save pressed: the client-side check. Anything missing is marked and nothing is sent. */
  | { type: "VALIDATED" }
  | { type: "SAVE_SUCCEEDED"; doc: D }
  /** The server found blank fields the client check let through. */
  | { type: "SAVE_REJECTED"; keys: string[] }
  | { type: "SAVE_FAILED"; code: string }
  | { type: "SAVE_RESULT_SEEN" };

export function initialEditorState<D extends EditorDoc>(doc: D): EditorState<D> {
  return {
    doc,
    selectedId: doc.questions[0]?.id ?? "",
    nextNumber: doc.questions.length + 1,
    errors: new Set(),
    saveResult: null,
    failedCode: null,
  };
}

/** The id of a quiz or an exam that has not been saved yet. */
export const NEW_QUIZ_ID = "new";

/** A new, empty quiz: one blank question so the editor has something to edit. */
export function blankQuiz(): Quiz {
  return {
    id: NEW_QUIZ_ID,
    title: "",
    status: "draft",
    questions: [
      {
        id: "question-1",
        text: "",
        answers: ["", "", "", ""],
        correct: 1,
        seconds: DEFAULT_SECONDS,
        readSeconds: DEFAULT_READ_SECONDS,
      },
    ],
  };
}

export const answerKey = (id: string, position: AnswerPosition) => `${id}:answer:${position}`;
export const textKey = (id: string) => `${id}:text`;

/** The check the server will run on save. Returns the keys of the empty fields. */
export function validateQuiz(doc: EditorDoc): string[] {
  const missing: string[] = [];
  if (doc.title.trim() === "") missing.push("title");
  for (const question of doc.questions) {
    missing.push(...missingForNext(question));
    // The right answer has to be one that has text.
    const correctKey = answerKey(question.id, question.correct as AnswerPosition);
    if ((question.answers[question.correct - 1] ?? "").trim() === "" && !missing.includes(correctKey)) {
      missing.push(correctKey);
    }
  }
  return missing;
}

/** Keys of what is missing before a question may be followed by a new one. */
function missingForNext(question: BaseQuestion): string[] {
  const missing: string[] = [];
  if (question.text.trim() === "") missing.push(textKey(question.id));
  const blank = question.answers
    .map((answer, index) => (answer.trim() === "" ? answerKey(question.id, (index + 1) as AnswerPosition) : null))
    .filter((key): key is string => key !== null);
  if (question.answers.length - blank.length < MIN_FILLED_ANSWERS) missing.push(...blank);
  return missing;
}

/** Once a question has what it needs to be followed by another, its leftover marks on blank answers go. */
function settled<D extends EditorDoc>(state: EditorState<D>): EditorState<D> {
  const question = state.doc.questions.find((q) => q.id === state.selectedId);
  if (!question || missingForNext(question).length > 0) return state;
  const errors = new Set([...state.errors].filter((key) => !key.startsWith(`${question.id}:answer:`)));
  return errors.size === state.errors.size ? state : { ...state, errors };
}

function without(errors: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(errors);
  next.delete(key);
  return next;
}

function updateSelected<D extends EditorDoc>(
  state: EditorState<D>,
  change: (question: QuestionOf<D>) => QuestionOf<D>,
): EditorState<D> {
  return {
    ...state,
    doc: {
      ...state.doc,
      questions: state.doc.questions.map((q) => (q.id === state.selectedId ? change(q) : q)),
    },
  };
}

function markInvalid<D extends EditorDoc>(state: EditorState<D>, missing: string[]): EditorState<D> {
  const firstQuestion = state.doc.questions.find((q) => missing.some((key) => key.startsWith(`${q.id}:`)));
  return {
    ...state,
    errors: new Set(missing),
    saveResult: "invalid",
    selectedId: firstQuestion?.id ?? state.selectedId,
  };
}

export function editorReducer<D extends EditorDoc>(state: EditorState<D>, event: EditorEvent<D>): EditorState<D> {
  switch (event.type) {
    case "TITLE_CHANGED":
      return { ...state, doc: { ...state.doc, title: event.title }, errors: without(state.errors, "title") };
    case "DOC_CHANGED":
      return { ...state, doc: { ...state.doc, ...event.change } };
    case "QUESTION_SELECTED":
      return state.doc.questions.some((q) => q.id === event.id) ? { ...state, selectedId: event.id } : state;
    case "QUESTION_TEXT_CHANGED":
      return settled({
        ...updateSelected(state, (q) => ({ ...q, text: event.text })),
        errors: without(state.errors, textKey(state.selectedId)),
      });
    case "ANSWER_TEXT_CHANGED":
      return settled({
        ...updateSelected(state, (q) => {
          const answers: BaseQuestion["answers"] = [...q.answers];
          answers[event.position - 1] = event.text;
          return { ...q, answers };
        }),
        errors: without(state.errors, answerKey(state.selectedId, event.position)),
      });
    case "CORRECT_CHANGED":
      return updateSelected(state, (q) => ({ ...q, correct: event.position }));
    case "QUESTION_IMAGE_CHANGED":
      return {
        ...state,
        doc: { ...state.doc, questions: state.doc.questions.map((q) => (q.id === event.id ? { ...q, image: event.image } : q)) },
      };
    case "QUESTION_CHANGED":
      return updateSelected(state, (q) => ({ ...q, ...event.change }));
    case "QUESTION_ADDED": {
      const current = state.doc.questions.find((q) => q.id === state.selectedId);
      if (!current) return state;
      const missing = missingForNext(current);
      if (missing.length > 0) return { ...state, errors: new Set(missing), saveResult: "invalid" };
      const id = `question-${state.nextNumber}`;
      // The new question starts with the times (and any other settings) of the one before it.
      const blank: QuestionOf<D> = { ...current, id, text: "", answers: ["", "", "", ""], correct: 1, image: null };
      return {
        ...state,
        doc: { ...state.doc, questions: [...state.doc.questions, blank] },
        selectedId: id,
        nextNumber: state.nextNumber + 1,
      };
    }
    case "QUESTION_REMOVED": {
      // A quiz keeps at least one question.
      if (state.doc.questions.length <= 1) return state;
      const index = state.doc.questions.findIndex((q) => q.id === event.id);
      if (index === -1) return state;
      const questions = state.doc.questions.filter((q) => q.id !== event.id);
      const selectedId =
        state.selectedId === event.id ? (questions[Math.min(index, questions.length - 1)]?.id ?? "") : state.selectedId;
      return { ...state, doc: { ...state.doc, questions }, selectedId };
    }
    case "QUESTION_MOVED": {
      const from = state.doc.questions.findIndex((q) => q.id === event.id);
      const to = Math.max(0, Math.min(state.doc.questions.length - 1, event.to));
      if (from === -1 || from === to) return state;
      const questions = [...state.doc.questions];
      const [moved] = questions.splice(from, 1);
      questions.splice(to, 0, moved!);
      return { ...state, doc: { ...state.doc, questions } };
    }
    case "DOC_REPLACED":
      return initialEditorState(event.doc);
    case "QUESTIONS_IMPORTED": {
      if (event.questions.length === 0) return state;
      // The blank question a new quiz starts with is replaced, not left in front.
      const kept = state.doc.questions.filter((q) => q.text.trim() !== "" || q.answers.some((a) => a.trim() !== "") || q.image);
      const taken = new Set(kept.map((q) => q.id));
      let nextNumber = state.nextNumber;
      const added = event.questions.map((question) => {
        while (taken.has(`question-${nextNumber}`)) nextNumber += 1;
        const id = `question-${nextNumber}`;
        nextNumber += 1;
        return { ...question, id };
      });
      const title = state.doc.title.trim() === "" && event.title ? event.title : state.doc.title;
      return {
        ...state,
        doc: { ...state.doc, title, questions: [...kept, ...added] },
        selectedId: added[0]?.id ?? state.selectedId,
        nextNumber,
        errors: title === state.doc.title ? state.errors : without(state.errors, "title"),
      };
    }
    case "VALIDATED": {
      const missing = validateQuiz(state.doc);
      return missing.length === 0 ? { ...state, errors: new Set() } : markInvalid(state, missing);
    }
    case "SAVE_SUCCEEDED":
      // A first save gets its real id from the server.
      return { ...state, doc: event.doc, saveResult: "saved" };
    case "SAVE_REJECTED":
      return markInvalid(state, event.keys);
    case "SAVE_FAILED":
      return { ...state, saveResult: "failed", failedCode: event.code };
    case "SAVE_RESULT_SEEN":
      return { ...state, saveResult: null };
  }
}
