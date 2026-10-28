"use client";

import { getLibraryQuiz } from "@/lib/api/quizzes";
import { QuizViewScreen } from "./QuizViewScreen";
import { ResourceView, useResource } from "./Resource";

/** /quizzes/library/<id>: another teacher's quiz, read-only, with «copy». */
export function LibraryQuizLoader({ id }: { id: string }) {
  const resource = useResource(() => getLibraryQuiz(id));
  return <ResourceView resource={resource}>{(quiz) => <QuizViewScreen quiz={quiz} library />}</ResourceView>;
}
