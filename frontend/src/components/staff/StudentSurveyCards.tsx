"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useDateTime } from "@/lib/useDateTime";
import type { StudentSurvey } from "@/types/survey";

/** The student's surveys, the ones still to answer first. */
export function StudentSurveyCards({ surveys }: { surveys: readonly StudentSurvey[] }) {
  const t = useTranslations("student.survey");
  const dateTime = useDateTime();
  const toAnswer = (s: StudentSurvey) => Number(s.status === "open" && !s.answered);

  return (
    <section className="flex flex-col gap-4" aria-labelledby="student-surveys-title">
      <h2 id="student-surveys-title" className="text-h1 font-black">
        {t("title")}
      </h2>
      <ul className="grid auto-rows-fr gap-4 pb-1 sm:grid-cols-2 lg:grid-cols-3">
        {[...surveys]
          .sort((a, b) => toAnswer(b) - toAnswer(a))
          .map((survey) => (
            <li key={survey.id} className="flex">
              <Card
                className={
                  "relative flex h-full min-h-[148px] flex-1 flex-col gap-2 transition-[transform,box-shadow] duration-150 ease-out " +
                  "hover:-translate-y-px hover:shadow-[0_5px_0_0_var(--border)] " +
                  "focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-focus-ring"
                }
              >
                <div className="flex flex-wrap gap-2">
                  {survey.answered ? (
                    <Badge variant="success">{t("state.answered")}</Badge>
                  ) : survey.status === "open" ? (
                    <Badge variant="accent">{t("state.open")}</Badge>
                  ) : (
                    <Badge variant="neutral">{t("state.closed")}</Badge>
                  )}
                </div>
                <h3 title={survey.title} className="line-clamp-2 text-h3 font-bold [overflow-wrap:anywhere]">
                  <Link href={`/student/surveys/${survey.id}`} className="outline-none after:absolute after:inset-0 after:content-['']">
                    {survey.title}
                  </Link>
                </h3>
                <p className="mt-auto text-body text-ink-muted">
                  {t("meta", { count: survey.questionCount })} · {dateTime(new Date(survey.openedAt))}
                </p>
              </Card>
            </li>
          ))}
      </ul>
    </section>
  );
}
