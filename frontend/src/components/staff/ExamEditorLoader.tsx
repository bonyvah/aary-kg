"use client";

import { getExam } from "@/lib/api/exams";
import { blankExam } from "@/lib/examEditor";
import { readDraft } from "@/lib/quizEditor/drafts";
import type { Exam } from "@/types/exam";
import { ExamEditorScreen } from "./ExamEditorScreen";
import { ResourceView, useResource } from "./Resource";

/** /exams/manage/new opens an empty editor. /exams/manage/<id> loads that exam first. */
export function ExamEditorLoader({ id }: { id: string | null }) {
  const resource = useResource(() => (id ? getExam(id) : Promise.resolve(readDraft<Exam>("exam") ?? blankExam())));
  return <ResourceView resource={resource}>{(exam) => <ExamEditorScreen exam={exam} />}</ResourceView>;
}
