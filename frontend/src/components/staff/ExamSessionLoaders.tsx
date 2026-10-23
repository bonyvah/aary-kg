"use client";

import { useSearchParams } from "next/navigation";
import { listExams } from "@/lib/api/exams";
import { getExamSession, listStudents } from "@/lib/api/examSessions";
import { listStaffGroups } from "@/lib/api/groups";
import { ExamSessionScreen } from "./ExamSessionScreen";
import { ExamSessionSetupScreen } from "./ExamSessionSetupScreen";
import { ResourceView, useResource } from "./Resource";

/** /exam-sessions/new: the sheets, the groups and the students to pick from. */
export function ExamSessionSetupLoader() {
  const examId = useSearchParams().get("exam");
  const resource = useResource(async () => {
    const [exams, groups, students] = await Promise.all([listExams(), listStaffGroups(), listStudents()]);
    return { exams, groups, students };
  });
  return (
    <ResourceView resource={resource}>
      {(data) => <ExamSessionSetupScreen {...data} examId={examId} />}
    </ResourceView>
  );
}

/** /exam-sessions/<id>: one exam. */
export function ExamSessionLoader({ id }: { id: string }) {
  const resource = useResource(async () => {
    const [session, students] = await Promise.all([getExamSession(id), listStudents()]);
    return { session, students };
  });
  return <ResourceView resource={resource}>{(data) => <ExamSessionScreen {...data} />}</ResourceView>;
}
