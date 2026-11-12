"use client";

import { useSearchParams } from "next/navigation";
import { listGroups } from "@/lib/api/groups";
import { getSurvey, listSurveySheets } from "@/lib/api/surveys";
import { ResourceView, useResource } from "./Resource";
import { SurveyResultsScreen } from "./SurveyResultsScreen";
import { SurveyStartScreen } from "./SurveyStartScreen";

/** /admin/surveys/new?sheet=<id>: the sheets and the groups, then the start screen. */
export function SurveyStartLoader() {
  const sheetId = useSearchParams().get("sheet");
  const resource = useResource(() => Promise.all([listSurveySheets(), listGroups()]));
  return (
    <ResourceView resource={resource}>
      {([sheets, groups]) => <SurveyStartScreen sheets={sheets} groups={groups} sheetId={sheetId} />}
    </ResourceView>
  );
}

/** /admin/surveys/<id>: the survey with its results. */
export function SurveyResultsLoader({ id }: { id: string }) {
  const resource = useResource(() => getSurvey(id));
  return <ResourceView resource={resource}>{(survey) => <SurveyResultsScreen survey={survey} />}</ResourceView>;
}
