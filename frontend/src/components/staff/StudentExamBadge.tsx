import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import type { StudentExam } from "@/types/studentExam";

/** Where the student stands: handed in, in progress, absent, or the exam's own state. */
export function StudentExamBadge({ exam }: { exam: StudentExam }) {
  const t = useTranslations("student.exam.state");
  if (exam.attempt?.state === "submitted") return <Badge variant="success">{t("submitted")}</Badge>;
  if (exam.attempt?.state === "in_progress") return <Badge variant="accent">{t("inProgress")}</Badge>;
  if (exam.attendance === "absent") return <Badge variant="danger">{t("absent")}</Badge>;
  return exam.status === "open" ? <Badge variant="accent">{t("open")}</Badge> : <Badge variant="neutral">{t("closed")}</Badge>;
}
