"use client";

import { getReport } from "@/lib/api/games";
import { ReportScreen } from "./ReportScreen";
import { ResourceView, useResource } from "./Resource";

/** /reports/<game id>: the report of a finished game, as the server saved it. */
export function ReportLoader({ id }: { id: string }) {
  const resource = useResource(() => getReport(id));
  return <ResourceView resource={resource}>{(report) => <ReportScreen report={report} />}</ResourceView>;
}
