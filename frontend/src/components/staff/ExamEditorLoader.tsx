"use client";

import { getExam } from "@/lib/api/exams";
import { blankExam } from "@/lib/examEditor";
import { readDraft } from "@/lib/quizEditor/drafts";
import { useDraftId } from "@/lib/quizEditor/useDraftId";
import type { Exam } from "@/types/exam";
import { ExamEditorScreen } from "./ExamEditorScreen";
import { ResourceView, useResource } from "./Resource";

/** /exams/manage/<id> loads that exam sheet first. */
export function ExamEditorLoader({ id }: { id: string }) {
  const resource = useResource(() => getExam(id));
  return <ResourceView resource={resource}>{(exam) => <ExamEditorScreen exam={exam} draftId={null} />}</ResourceView>;
}

/** /exams/manage/new?draft=<id>: that draft, or an empty exam sheet under a new draft id. */
export function NewExamLoader() {
  const draftId = useDraftId();
  if (!draftId) return null;
  return <ExamEditorScreen key={draftId} exam={readDraft<Exam>("exam", draftId) ?? blankExam()} draftId={draftId} />;
}
