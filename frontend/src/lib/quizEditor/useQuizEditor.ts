"use client";

import { useCallback, useReducer } from "react";
import type { AnswerPosition } from "@/components/game/AnswerTile";
import type { Quiz } from "@/types/quiz";
import { editorReducer, initialEditorState } from "./reducer";

/** Local state of the quiz editor. «Save» only validates in the mock; Phase 5 sends it to the API. */
export function useQuizEditor(quiz: Quiz) {
  const [state, dispatch] = useReducer(editorReducer, quiz, initialEditorState);

  return {
    state,
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
    save: useCallback(() => dispatch({ type: "SAVED" }), []),
    clearSaveResult: useCallback(() => dispatch({ type: "SAVE_RESULT_SEEN" }), []),
  };
}
