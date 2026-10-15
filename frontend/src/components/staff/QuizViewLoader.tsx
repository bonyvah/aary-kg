"use client";

import { getQuiz } from "@/lib/api/quizzes";
import { ResourceView, useResource } from "./Resource";
import { QuizViewScreen } from "./QuizViewScreen";

/** /quizzes/view/<id>: loads the quiz, then shows it read-only. */
export function QuizViewLoader({ id }: { id: string }) {
  const resource = useResource(() => getQuiz(id));
  return <ResourceView resource={resource}>{(quiz) => <QuizViewScreen quiz={quiz} />}</ResourceView>;
}
