import type { AnswerPosition } from "@/components/game/AnswerTile";
import type { Quiz, QuizQuestion } from "@/types/quiz";

export const SECONDS_OPTIONS = [10, 20, 30, 60] as const;
export const DEFAULT_SECONDS = 20;

export type EditorState = {
  quiz: Quiz;
  selectedId: string;
  /** Counter for new question ids. */
  nextNumber: number;
  /** Keys of the fields that failed the last save: `title`, `<id>:text`, `<id>:answer:<position>`. */
  errors: ReadonlySet<string>;
  /** The last save result, so the screen can show a toast. */
  saveResult: "saved" | "invalid" | null;
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
  | { type: "SAVED" }
  | { type: "SAVE_RESULT_SEEN" };

export function initialEditorState(quiz: Quiz): EditorState {
  return {
    quiz,
    selectedId: quiz.questions[0]?.id ?? "",
    nextNumber: quiz.questions.length + 1,
    errors: new Set(),
    saveResult: null,
  };
}

export const answerKey = (id: string, position: AnswerPosition) => `${id}:answer:${position}`;
export const textKey = (id: string) => `${id}:text`;

/** The check the server will run on save. Returns the keys of the empty fields. */
export function validateQuiz(quiz: Quiz): string[] {
  const missing: string[] = [];
  if (quiz.title.trim() === "") missing.push("title");
  for (const question of quiz.questions) {
    if (question.text.trim() === "") missing.push(textKey(question.id));
    question.answers.forEach((answer, index) => {
      if (answer.trim() === "") missing.push(answerKey(question.id, (index + 1) as AnswerPosition));
    });
  }
  return missing;
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

export function editorReducer(state: EditorState, event: EditorEvent): EditorState {
  switch (event.type) {
    case "TITLE_CHANGED":
      return { ...state, quiz: { ...state.quiz, title: event.title }, errors: without(state.errors, "title") };
    case "QUESTION_SELECTED":
      return state.quiz.questions.some((q) => q.id === event.id) ? { ...state, selectedId: event.id } : state;
    case "QUESTION_TEXT_CHANGED":
      return {
        ...updateSelected(state, (q) => ({ ...q, text: event.text })),
        errors: without(state.errors, textKey(state.selectedId)),
      };
    case "ANSWER_TEXT_CHANGED":
      return {
        ...updateSelected(state, (q) => {
          const answers: QuizQuestion["answers"] = [...q.answers];
          answers[event.position - 1] = event.text;
          return { ...q, answers };
        }),
        errors: without(state.errors, answerKey(state.selectedId, event.position)),
      };
    case "CORRECT_CHANGED":
      return updateSelected(state, (q) => ({ ...q, correct: event.position }));
    case "SECONDS_CHANGED":
      return updateSelected(state, (q) => ({ ...q, seconds: event.seconds }));
    case "QUESTION_ADDED": {
      const id = `question-${state.nextNumber}`;
      const blank: QuizQuestion = { id, text: "", answers: ["", "", "", ""], correct: 1, seconds: DEFAULT_SECONDS };
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
    case "SAVED": {
      const missing = validateQuiz(state.quiz);
      if (missing.length === 0) return { ...state, errors: new Set(), saveResult: "saved" };
      const firstQuestion = state.quiz.questions.find((q) => missing.some((key) => key.startsWith(`${q.id}:`)));
      return {
        ...state,
        errors: new Set(missing),
        saveResult: "invalid",
        selectedId: firstQuestion?.id ?? state.selectedId,
      };
    }
    case "SAVE_RESULT_SEEN":
      return { ...state, saveResult: null };
  }
}
