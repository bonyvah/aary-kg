"use client";

import { getStudentExam } from "@/lib/api/studentExams";
import { ResourceView, useResource } from "./Resource";
import { StudentExamScreen } from "./StudentExamScreen";

/** /student/exams/<id>: one exam of the signed-in student. */
export function StudentExamLoader({ id }: { id: string }) {
  const resource = useResource(() => getStudentExam(id));
  return <ResourceView resource={resource}>{(exam) => <StudentExamScreen exam={exam} />}</ResourceView>;
}
