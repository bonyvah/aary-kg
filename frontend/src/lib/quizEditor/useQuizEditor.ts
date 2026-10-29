"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useState } from "react";
import type { AnswerPosition } from "@/components/game/AnswerTile";
import { createExam, deleteExam, updateExam } from "@/lib/api/exams";
import { createQuiz, deleteQuiz, updateQuiz } from "@/lib/api/quizzes";
import { ApiRequestError } from "@/lib/api/client";
import type { Exam } from "@/types/exam";
import type { Quiz } from "@/types/quiz";
import { clearDraft, hasContent, writeDraft, type DraftKind } from "./drafts";
import { editorReducer, initialEditorState, NEW_QUIZ_ID, validateQuiz, type EditorDoc, type EditorEvent } from "./reducer";

type SaveApi<D extends EditorDoc> = {
  create: (doc: D) => Promise<D>;
  update: (doc: D) => Promise<D>;
  /** The code the server answers with when it finds blank fields. */
  invalidCode: string;
  /** Where a new document is kept in this browser until it is saved. */
  draft: DraftKind;
  remove: (id: string) => Promise<void>;
};

/** State of the editor. «Save» checks the fields here first, then sends the document to the API. */
/** `draftId`: where a new document is kept in this browser while it is written (null when editing a saved one). */
export function useDocEditor<D extends EditorDoc>(doc: D, api: SaveApi<D>, draftId: string | null) {
  const [state, dispatch] = useReducer(
    (current: ReturnType<typeof initialEditorState<D>>, event: EditorEvent<D>) => editorReducer(current, event),
    doc,
    initialEditorState<D>,
  );
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const isNew = state.doc.id === NEW_QUIZ_ID;

  // A new document is kept as a draft as it is written, so closing the tab loses nothing.
  useEffect(() => {
    if (isNew && draftId && hasContent(state.doc)) writeDraft(api.draft, draftId, state.doc);
  }, [isNew, draftId, state.doc, api.draft]);

  const save = useCallback(async () => {
    dispatch({ type: "VALIDATED" });
    if (validateQuiz(state.doc).length > 0) return;
    setSaving(true);
    try {
      const saved = isNew ? await api.create(state.doc) : await api.update(state.doc);
      if (isNew && draftId) clearDraft(api.draft, draftId);
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
  }, [state.doc, router, api, isNew, draftId]);

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
    setQuestionImage: useCallback(
      (id: string, image: string | null) => dispatch({ type: "QUESTION_IMAGE_CHANGED", id, image }),
      [],
    ),
    changeQuestion: useCallback(
      (change: Partial<Omit<Question, "id" | "text" | "answers">>) => dispatch({ type: "QUESTION_CHANGED", change }),
      [],
    ),
    addQuestion: useCallback(() => dispatch({ type: "QUESTION_ADDED" }), []),
    removeQuestion: useCallback((id: string) => dispatch({ type: "QUESTION_REMOVED", id }), []),
    moveQuestion: useCallback((id: string, to: number) => dispatch({ type: "QUESTION_MOVED", id, to }), []),
    isNew,
    /** Deletes a saved document (the server keeps it hidden if it was used) and goes back to the dashboard. */
    remove: useCallback(async () => {
      try {
        await api.remove(state.doc.id);
        router.push("/dashboard");
      } catch (error) {
        dispatch({ type: "SAVE_FAILED", code: error instanceof ApiRequestError ? error.code : "UNKNOWN" });
      }
    }, [api, state.doc.id, router]),
    /** Throws this draft away and goes back to the dashboard. */
    discardDraft: useCallback(() => {
      if (draftId) clearDraft(api.draft, draftId);
      router.push("/dashboard");
    }, [api.draft, draftId, router]),
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
  create: (quiz) => createQuiz({ title: quiz.title, image: quiz.image ?? null, questions: quiz.questions }),
  update: (quiz) => updateQuiz(quiz.id, { title: quiz.title, image: quiz.image ?? null, questions: quiz.questions }),
  invalidCode: "QUIZ_INVALID",
  draft: "quiz",
  remove: deleteQuiz,
};

const EXAM_API: SaveApi<Exam> = {
  create: (exam) => createExam({ title: exam.title, minutes: exam.minutes, questions: exam.questions }),
  update: (exam) => updateExam(exam.id, { title: exam.title, minutes: exam.minutes, questions: exam.questions }),
  invalidCode: "EXAM_INVALID",
  draft: "exam",
  remove: deleteExam,
};

export const useQuizEditor = (quiz: Quiz, draftId: string | null) => useDocEditor(quiz, QUIZ_API, draftId);

export const useExamEditor = (exam: Exam, draftId: string | null) => useDocEditor(exam, EXAM_API, draftId);
