"use client";

import { getQuiz } from "@/lib/api/quizzes";
import { blankQuiz } from "@/lib/quizEditor/reducer";
import { EditorScreen } from "./EditorScreen";
import { ResourceView, useResource } from "./Resource";

/** /quizzes/new opens an empty editor. /quizzes/<id> loads that quiz first. */
export function QuizEditorLoader({ id }: { id: string | null }) {
  const resource = useResource(() => (id ? getQuiz(id) : Promise.resolve(blankQuiz())));
  return <ResourceView resource={resource}>{(quiz) => <EditorScreen quiz={quiz} />}</ResourceView>;
}
