"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Exam } from "@phosphor-icons/react/ssr";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { listStudentExams } from "@/lib/api/studentExams";
import { useDateTime } from "@/lib/useDateTime";
import { ResourceView, useResource } from "./Resource";
import { StaffMenu } from "./StaffMenu";
import { StaffShell } from "./StaffShell";
import { StudentExamBadge } from "./StudentExamBadge";

/** Where a student lands after signing in: their exams, open ones first. */
export function StudentHomeScreen() {
  const t = useTranslations("student.home");
  const te = useTranslations("student.exam");
  const dateTime = useDateTime();
  const exams = useResource(listStudentExams);

  return (
    <StaffShell
      topRight={
        <div className="flex items-center gap-3">
          <StaffMenu />
        </div>
      }
    >
      <h1 className="text-h1 font-black">{t("title")}</h1>
      <ResourceView resource={exams} inline>
        {(items) =>
          items.length > 0 ? (
            <ul className="grid auto-rows-fr gap-4 pb-1 sm:grid-cols-2 lg:grid-cols-3">
              {[...items]
                .sort((a, b) => Number(b.status === "open") - Number(a.status === "open"))
                .map((exam) => (
                  <li key={exam.id} className="flex">
                    <Card
                      className={
                        "relative flex h-full min-h-[148px] flex-1 flex-col gap-2 transition-[transform,box-shadow] duration-150 ease-out " +
                        "hover:-translate-y-px hover:shadow-[0_5px_0_0_var(--border)] " +
                        "focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-focus-ring"
                      }
                    >
                      <div className="flex flex-wrap gap-2">
                        <StudentExamBadge exam={exam} />
                      </div>
                      <h2 title={exam.title} className="line-clamp-2 text-h3 font-bold [overflow-wrap:anywhere]">
                        <Link href={`/student/exams/${exam.id}`} className="outline-none after:absolute after:inset-0 after:content-['']">
                          {exam.title}
                        </Link>
                      </h2>
                      {exam.result ? (
                        <p className="text-h3 font-black tabular-nums">
                          {te("result.score", { score: exam.result.score, total: exam.result.total })}
                        </p>
                      ) : null}
                      <p className="mt-auto text-body text-ink-muted">
                        {te("meta", { count: exam.questionCount, minutes: exam.minutes })} · {dateTime(new Date(exam.openedAt))}
                      </p>
                    </Card>
                  </li>
                ))}
            </ul>
          ) : (
            <EmptyState icon={Exam} title={t("empty")} />
          )
        }
      </ResourceView>
    </StaffShell>
  );
}
