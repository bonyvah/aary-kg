"use client";

import { getQuiz } from "@/lib/api/quizzes";
import { readDraft } from "@/lib/quizEditor/drafts";
import { blankQuiz } from "@/lib/quizEditor/reducer";
import { useDraftId } from "@/lib/quizEditor/useDraftId";
import type { Quiz } from "@/types/quiz";
import { EditorScreen } from "./EditorScreen";
import { ResourceView, useResource } from "./Resource";

/** /quizzes/manage/<id> loads that quiz first. */
export function QuizEditorLoader({ id }: { id: string }) {
  const resource = useResource(() => getQuiz(id));
  return <ResourceView resource={resource}>{(quiz) => <EditorScreen quiz={quiz} draftId={null} />}</ResourceView>;
}

/** /quizzes/manage/new?draft=<id>: that draft, or an empty quiz under a new draft id. */
export function NewQuizLoader() {
  const draftId = useDraftId();
  if (!draftId) return null;
  return <EditorScreen key={draftId} quiz={readDraft<Quiz>("quiz", draftId) ?? blankQuiz()} draftId={draftId} />;
}
