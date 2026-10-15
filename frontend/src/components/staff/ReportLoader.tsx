"use client";

import { getQuiz } from "@/lib/api/quizzes";
import { buildMockReport } from "@/mocks/report";
import { ReportScreen } from "./ReportScreen";
import { ResourceView, useResource } from "./Resource";

/** The quiz is real; the players and flags in the report are still mock until games are stored. */
export function ReportLoader({ id }: { id: string }) {
  const resource = useResource(() => getQuiz(id));
  return <ResourceView resource={resource}>{(quiz) => <ReportScreen report={buildMockReport(quiz)} />}</ResourceView>;
}
