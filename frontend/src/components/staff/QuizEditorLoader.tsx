"use client";

import { getQuiz } from "@/lib/api/quizzes";
import { blankQuiz } from "@/lib/quizEditor/reducer";
import { readDraft } from "@/lib/quizEditor/drafts";
import type { Quiz } from "@/types/quiz";
import { EditorScreen } from "./EditorScreen";
import { ResourceView, useResource } from "./Resource";

/** /quizzes/manage/new opens the draft being written, or an empty quiz. /quizzes/manage/<id> loads that quiz first. */
export function QuizEditorLoader({ id }: { id: string | null }) {
  const resource = useResource(() => (id ? getQuiz(id) : Promise.resolve(readDraft<Quiz>("quiz") ?? blankQuiz())));
  return <ResourceView resource={resource}>{(quiz) => <EditorScreen quiz={quiz} />}</ResourceView>;
}
