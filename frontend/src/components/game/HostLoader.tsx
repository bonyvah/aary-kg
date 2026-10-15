"use client";

import { getQuiz } from "@/lib/api/quizzes";
import { ResourceView, useResource } from "@/components/staff/Resource";
import { HostFlow } from "./HostFlow";

/** Loads the quiz to host. The game itself is still the mock engine until the live backend lands. */
export function HostLoader({ id }: { id: string }) {
  const resource = useResource(() => getQuiz(id));
  return <ResourceView resource={resource}>{(quiz) => <HostFlow quiz={quiz} />}</ResourceView>;
}
