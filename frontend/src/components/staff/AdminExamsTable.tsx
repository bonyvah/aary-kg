import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Exam } from "@phosphor-icons/react/ssr";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, Td, Th } from "@/components/ui/Table";
import { useDateTime } from "@/lib/useDateTime";
import type { ExamSessionSummary } from "@/types/examSession";
import { ExamSessionStatusBadge } from "./ExamSessionStatusBadge";

/** Every exam of every teacher, for admins. A row opens the exam to read. */
export function AdminExamsTable({ exams }: { exams: readonly ExamSessionSummary[] }) {
  const t = useTranslations("admin.exams");
  const format = useFormatter();
  const dateTime = useDateTime();

  if (exams.length === 0) return <EmptyState icon={Exam} title={t("empty")} />;

  return (
    <Table className="min-w-[760px]">
      <thead>
        <tr>
          <Th>{t("title")}</Th>
          <Th>{t("teacher")}</Th>
          <Th>{t("groups")}</Th>
          <Th>{t("opened")}</Th>
          <Th>{t("status")}</Th>
          <Th className="text-right">{t("students")}</Th>
        </tr>
      </thead>
      <tbody>
        {exams.map((exam) => (
          <tr key={exam.id}>
            <Td className="font-bold">
              <Link
                href={`/exam-sessions/${exam.id}`}
                className="break-words underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                {exam.title}
              </Link>
            </Td>
            <Td>{exam.ownerName}</Td>
            <Td>{exam.groupNames.join(", ")}</Td>
            <Td className="whitespace-nowrap">{dateTime(new Date(exam.openedAt))}</Td>
            <Td>
              <ExamSessionStatusBadge status={exam.status} />
            </Td>
            <Td className="text-right tabular-nums">{format.number(exam.studentCount)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
