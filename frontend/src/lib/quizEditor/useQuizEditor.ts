"use client";

import { useRouter } from "next/navigation";
import { useCallback, useReducer, useState } from "react";
import type { AnswerPosition } from "@/components/game/AnswerTile";
import { createQuiz, updateQuiz } from "@/lib/api/quizzes";
import { ApiRequestError } from "@/lib/api/client";
import type { Quiz } from "@/types/quiz";
import { editorReducer, initialEditorState, NEW_QUIZ_ID, validateQuiz, type EditorDoc, type EditorEvent } from "./reducer";

type SaveApi<D extends EditorDoc> = {
  create: (doc: D) => Promise<D>;
  update: (doc: D) => Promise<D>;
  /** The code the server answers with when it finds blank fields. */
  invalidCode: string;
};

/** State of the editor. «Save» checks the fields here first, then sends the document to the API. */
export function useDocEditor<D extends EditorDoc>(doc: D, api: SaveApi<D>) {
  const [state, dispatch] = useReducer(
    (current: ReturnType<typeof initialEditorState<D>>, event: EditorEvent<D>) => editorReducer(current, event),
    doc,
    initialEditorState<D>,
  );
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const save = useCallback(async () => {
    dispatch({ type: "VALIDATED" });
    if (validateQuiz(state.doc).length > 0) return;
    const isNew = state.doc.id === NEW_QUIZ_ID;
    setSaving(true);
    try {
      const saved = isNew ? await api.create(state.doc) : await api.update(state.doc);
      dispatch({ type: "SAVE_SUCCEEDED", doc: saved });
      router.push("/dashboard");
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === api.invalidCode) {
        dispatch({ type: "SAVE_REJECTED", keys: error.issues.map((issue) => issue.field) });
      } else {
        dispatch({ type: "SAVE_FAILED", code: error instanceof ApiRequestError ? error.code : "UNKNOWN" });
      }
    } finally {
      setSaving(false);
    }
  }, [state.doc, router, api]);

  type Question = D["questions"][number];
  return {
    state,
    saving,
    setTitle: useCallback((title: string) => dispatch({ type: "TITLE_CHANGED", title }), []),
    changeDoc: useCallback(
      (change: Partial<Omit<D, "id" | "title" | "questions">>) => dispatch({ type: "DOC_CHANGED", change }),
      [],
    ),
    select: useCallback((id: string) => dispatch({ type: "QUESTION_SELECTED", id }), []),
    setQuestionText: useCallback((text: string) => dispatch({ type: "QUESTION_TEXT_CHANGED", text }), []),
    setAnswerText: useCallback(
      (position: AnswerPosition, text: string) => dispatch({ type: "ANSWER_TEXT_CHANGED", position, text }),
      [],
    ),
    setCorrect: useCallback((position: AnswerPosition) => dispatch({ type: "CORRECT_CHANGED", position }), []),
    changeQuestion: useCallback(
      (change: Partial<Omit<Question, "id" | "text" | "answers">>) => dispatch({ type: "QUESTION_CHANGED", change }),
      [],
    ),
    addQuestion: useCallback(() => dispatch({ type: "QUESTION_ADDED" }), []),
    removeQuestion: useCallback((id: string) => dispatch({ type: "QUESTION_REMOVED", id }), []),
    importQuestions: useCallback(
      (title: string | null, questions: Omit<Question, "id">[]) => dispatch({ type: "QUESTIONS_IMPORTED", title, questions }),
      [],
    ),
    save,
    clearSaveResult: useCallback(() => dispatch({ type: "SAVE_RESULT_SEEN" }), []),
  };
}

export type DocEditor<D extends EditorDoc> = ReturnType<typeof useDocEditor<D>>;

const QUIZ_API: SaveApi<Quiz> = {
  create: (quiz) => createQuiz({ title: quiz.title, questions: quiz.questions }),
  update: (quiz) => updateQuiz(quiz.id, { title: quiz.title, questions: quiz.questions }),
  invalidCode: "QUIZ_INVALID",
};

export const useQuizEditor = (quiz: Quiz) => useDocEditor(quiz, QUIZ_API);
