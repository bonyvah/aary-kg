"use client";

import { getStudentSurvey } from "@/lib/api/studentSurveys";
import { ResourceView, useResource } from "./Resource";
import { SurveyTakingScreen } from "./SurveyTakingScreen";

/** /student/surveys/<id>: one survey of the signed-in student. */
export function StudentSurveyLoader({ id }: { id: string }) {
  const resource = useResource(() => getStudentSurvey(id));
  return <ResourceView resource={resource}>{(survey) => <SurveyTakingScreen survey={survey} />}</ResourceView>;
}
