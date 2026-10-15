"use client";

import { useRouter } from "next/navigation";
import { useCallback, useReducer, useState } from "react";
import type { AnswerPosition } from "@/components/game/AnswerTile";
import { createQuiz, updateQuiz } from "@/lib/api/quizzes";
import { ApiRequestError } from "@/lib/api/client";
import type { Quiz } from "@/types/quiz";
import { editorReducer, initialEditorState, NEW_QUIZ_ID, validateQuiz } from "./reducer";

/** State of the quiz editor. «Save» checks the fields here first, then sends the quiz to the API. */
export function useQuizEditor(quiz: Quiz) {
  const [state, dispatch] = useReducer(editorReducer, quiz, initialEditorState);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const save = useCallback(async () => {
    dispatch({ type: "VALIDATED" });
    if (validateQuiz(state.quiz).length > 0) return;
    const input = { title: state.quiz.title, questions: state.quiz.questions };
    const isNew = state.quiz.id === NEW_QUIZ_ID;
    setSaving(true);
    try {
      const saved = isNew ? await createQuiz(input) : await updateQuiz(state.quiz.id, input);
      dispatch({ type: "SAVE_SUCCEEDED", quiz: saved });
      router.push("/dashboard");
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "QUIZ_INVALID") {
        dispatch({ type: "SAVE_REJECTED", keys: error.issues.map((issue) => issue.field) });
      } else {
        dispatch({ type: "SAVE_FAILED", code: error instanceof ApiRequestError ? error.code : "UNKNOWN" });
      }
    } finally {
      setSaving(false);
    }
  }, [state.quiz, router]);

  return {
    state,
    saving,
    setTitle: useCallback((title: string) => dispatch({ type: "TITLE_CHANGED", title }), []),
    select: useCallback((id: string) => dispatch({ type: "QUESTION_SELECTED", id }), []),
    setQuestionText: useCallback((text: string) => dispatch({ type: "QUESTION_TEXT_CHANGED", text }), []),
    setAnswerText: useCallback(
      (position: AnswerPosition, text: string) => dispatch({ type: "ANSWER_TEXT_CHANGED", position, text }),
      [],
    ),
    setCorrect: useCallback((position: AnswerPosition) => dispatch({ type: "CORRECT_CHANGED", position }), []),
    setSeconds: useCallback((seconds: number) => dispatch({ type: "SECONDS_CHANGED", seconds }), []),
    addQuestion: useCallback(() => dispatch({ type: "QUESTION_ADDED" }), []),
    removeQuestion: useCallback((id: string) => dispatch({ type: "QUESTION_REMOVED", id }), []),
    save,
    clearSaveResult: useCallback(() => dispatch({ type: "SAVE_RESULT_SEEN" }), []),
  };
}
