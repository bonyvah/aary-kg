"use client";

import { getSurveySheet } from "@/lib/api/surveys";
import { blankSheet } from "@/lib/surveyEditor";
import { ResourceView, useResource } from "./Resource";
import { SurveySheetEditorScreen } from "./SurveySheetEditorScreen";

/** /admin/surveys/sheets/<id> loads that sheet first. */
export function SurveySheetLoader({ id }: { id: string }) {
  const resource = useResource(() => getSurveySheet(id));
  return <ResourceView resource={resource}>{(sheet) => <SurveySheetEditorScreen key={sheet.id} sheet={sheet} />}</ResourceView>;
}

/** /admin/surveys/sheets/new: an empty sheet. */
export function NewSurveySheet() {
  return <SurveySheetEditorScreen sheet={blankSheet()} />;
}
