import type { AnswerPosition } from "@/components/game/AnswerTile";
import type { Quiz, QuizQuestion } from "@/types/quiz";

export const SECONDS_OPTIONS = [10, 20, 30, 60] as const;
export const DEFAULT_SECONDS = 20;
export const MIN_SECONDS = 5;
export const MAX_SECONDS = 300;
/** A question needs its text and at least this many filled answers before the next one is added. */
export const MIN_FILLED_ANSWERS = 2;

export type EditorState = {
  quiz: Quiz;
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

export type EditorEvent =
  | { type: "TITLE_CHANGED"; title: string }
  | { type: "QUESTION_SELECTED"; id: string }
  | { type: "QUESTION_TEXT_CHANGED"; text: string }
  | { type: "ANSWER_TEXT_CHANGED"; position: AnswerPosition; text: string }
  | { type: "CORRECT_CHANGED"; position: AnswerPosition }
  | { type: "SECONDS_CHANGED"; seconds: number }
  | { type: "QUESTION_ADDED" }
  | { type: "QUESTION_REMOVED"; id: string }
  /** Save pressed: the client-side check. Anything missing is marked and nothing is sent. */
  | { type: "VALIDATED" }
  | { type: "SAVE_SUCCEEDED"; quiz: Quiz }
  /** The server found blank fields the client check let through. */
  | { type: "SAVE_REJECTED"; keys: string[] }
  | { type: "SAVE_FAILED"; code: string }
  | { type: "SAVE_RESULT_SEEN" };

export function initialEditorState(quiz: Quiz): EditorState {
  return {
    quiz,
    selectedId: quiz.questions[0]?.id ?? "",
    nextNumber: quiz.questions.length + 1,
    errors: new Set(),
    saveResult: null,
    failedCode: null,
  };
}

/** The id of a quiz that has not been saved yet. */
export const NEW_QUIZ_ID = "new";

/** A new, empty quiz: one blank question so the editor has something to edit. */
export function blankQuiz(): Quiz {
  return {
    id: NEW_QUIZ_ID,
    title: "",
    status: "draft",
    questions: [{ id: "question-1", text: "", answers: ["", "", "", ""], correct: 1, seconds: DEFAULT_SECONDS }],
  };
}

export const answerKey = (id: string, position: AnswerPosition) => `${id}:answer:${position}`;
export const textKey = (id: string) => `${id}:text`;

/** The check the server will run on save. Returns the keys of the empty fields. */
export function validateQuiz(quiz: Quiz): string[] {
  const missing: string[] = [];
  if (quiz.title.trim() === "") missing.push("title");
  for (const question of quiz.questions) {
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
function missingForNext(question: QuizQuestion): string[] {
  const missing: string[] = [];
  if (question.text.trim() === "") missing.push(textKey(question.id));
  const blank = question.answers
    .map((answer, index) => (answer.trim() === "" ? answerKey(question.id, (index + 1) as AnswerPosition) : null))
    .filter((key): key is string => key !== null);
  if (question.answers.length - blank.length < MIN_FILLED_ANSWERS) missing.push(...blank);
  return missing;
}

/** Once a question has what it needs to be followed by another, its leftover marks on blank answers go. */
function settled(state: EditorState): EditorState {
  const question = state.quiz.questions.find((q) => q.id === state.selectedId);
  if (!question || missingForNext(question).length > 0) return state;
  const errors = new Set([...state.errors].filter((key) => !key.startsWith(`${question.id}:answer:`)));
  return errors.size === state.errors.size ? state : { ...state, errors };
}

function without(errors: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(errors);
  next.delete(key);
  return next;
}

function updateSelected(state: EditorState, change: (question: QuizQuestion) => QuizQuestion): EditorState {
  return {
    ...state,
    quiz: {
      ...state.quiz,
      questions: state.quiz.questions.map((q) => (q.id === state.selectedId ? change(q) : q)),
    },
  };
}

function markInvalid(state: EditorState, missing: string[]): EditorState {
  const firstQuestion = state.quiz.questions.find((q) => missing.some((key) => key.startsWith(`${q.id}:`)));
  return {
    ...state,
    errors: new Set(missing),
    saveResult: "invalid",
    selectedId: firstQuestion?.id ?? state.selectedId,
  };
}

export function editorReducer(state: EditorState, event: EditorEvent): EditorState {
  switch (event.type) {
    case "TITLE_CHANGED":
      return { ...state, quiz: { ...state.quiz, title: event.title }, errors: without(state.errors, "title") };
    case "QUESTION_SELECTED":
      return state.quiz.questions.some((q) => q.id === event.id) ? { ...state, selectedId: event.id } : state;
    case "QUESTION_TEXT_CHANGED":
      return settled({
        ...updateSelected(state, (q) => ({ ...q, text: event.text })),
        errors: without(state.errors, textKey(state.selectedId)),
      });
    case "ANSWER_TEXT_CHANGED":
      return settled({
        ...updateSelected(state, (q) => {
          const answers: QuizQuestion["answers"] = [...q.answers];
          answers[event.position - 1] = event.text;
          return { ...q, answers };
        }),
        errors: without(state.errors, answerKey(state.selectedId, event.position)),
      });
    case "CORRECT_CHANGED":
      return updateSelected(state, (q) => ({ ...q, correct: event.position }));
    case "SECONDS_CHANGED":
      return updateSelected(state, (q) => ({ ...q, seconds: event.seconds }));
    case "QUESTION_ADDED": {
      const current = state.quiz.questions.find((q) => q.id === state.selectedId);
      const missing = current ? missingForNext(current) : [];
      if (missing.length > 0) return { ...state, errors: new Set(missing), saveResult: "invalid" };
      const id = `question-${state.nextNumber}`;
      // The new question starts with the time of the one before it.
      const seconds = current?.seconds ?? DEFAULT_SECONDS;
      const blank: QuizQuestion = { id, text: "", answers: ["", "", "", ""], correct: 1, seconds };
      return {
        ...state,
        quiz: { ...state.quiz, questions: [...state.quiz.questions, blank] },
        selectedId: id,
        nextNumber: state.nextNumber + 1,
      };
    }
    case "QUESTION_REMOVED": {
      // A quiz keeps at least one question.
      if (state.quiz.questions.length <= 1) return state;
      const index = state.quiz.questions.findIndex((q) => q.id === event.id);
      if (index === -1) return state;
      const questions = state.quiz.questions.filter((q) => q.id !== event.id);
      const selectedId =
        state.selectedId === event.id ? (questions[Math.min(index, questions.length - 1)]?.id ?? "") : state.selectedId;
      return { ...state, quiz: { ...state.quiz, questions }, selectedId };
    }
    case "VALIDATED": {
      const missing = validateQuiz(state.quiz);
      return missing.length === 0 ? { ...state, errors: new Set() } : markInvalid(state, missing);
    }
    case "SAVE_SUCCEEDED":
      // A first save gets its real id from the server.
      return { ...state, quiz: { ...state.quiz, id: event.quiz.id, status: event.quiz.status }, saveResult: "saved" };
    case "SAVE_REJECTED":
      return markInvalid(state, event.keys);
    case "SAVE_FAILED":
      return { ...state, saveResult: "failed", failedCode: event.code };
    case "SAVE_RESULT_SEEN":
      return { ...state, saveResult: null };
  }
}
