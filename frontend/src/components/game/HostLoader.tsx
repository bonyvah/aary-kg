"use client";

import { ApiRequestError } from "@/lib/api/client";
import { getLibraryQuiz, getQuiz } from "@/lib/api/quizzes";
import type { Quiz } from "@/types/quiz";
import { ResourceView, useResource } from "@/components/staff/Resource";
import { HostFlow } from "./HostFlow";

/** One's own quiz, or another teacher's from the bazar (hosted as it is, not copied). */
async function hostable(id: string): Promise<Quiz> {
  try {
    return await getQuiz(id);
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.code !== "QUIZ_NOT_FOUND") throw error;
    return { ...(await getLibraryQuiz(id)), status: "ready" };
  }
}

/** Loads the quiz to host. */
export function HostLoader({ id }: { id: string }) {
  const resource = useResource(() => hostable(id));
  return <ResourceView resource={resource}>{(quiz) => <HostFlow quiz={quiz} />}</ResourceView>;
}
