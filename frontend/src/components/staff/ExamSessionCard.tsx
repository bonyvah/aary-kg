import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { useDateTime } from "@/lib/useDateTime";
import type { ExamSessionSummary } from "@/types/examSession";
import { ExamSessionStatusBadge } from "./ExamSessionStatusBadge";

/** The title is the link and its hit area covers the card, as on the quiz card. */
export function ExamSessionCard({ session }: { session: ExamSessionSummary }) {
  const t = useTranslations("staff.examSession");
  const dateTime = useDateTime();

  return (
    <Card
      className={
        "relative flex h-full min-h-[148px] flex-col gap-2 transition-[transform,box-shadow] duration-150 ease-out " +
        "hover:-translate-y-px hover:shadow-[0_5px_0_0_var(--border)] " +
        "focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-focus-ring"
      }
    >
      <div className="flex flex-wrap gap-2">
        <ExamSessionStatusBadge status={session.status} />
      </div>
      <h2 title={session.title} className="line-clamp-2 text-h3 font-bold [overflow-wrap:anywhere]">
        <Link href={`/exam-sessions/${session.id}`} className="outline-none after:absolute after:inset-0 after:content-['']">
          {session.title}
        </Link>
      </h2>
      {session.groupNames.length > 0 ? (
        <p className="text-body font-bold [overflow-wrap:anywhere]">{session.groupNames.join(", ")}</p>
      ) : null}
      <p className="mt-auto text-body text-ink-muted">
        {dateTime(new Date(session.openedAt))} · {t("studentCount", { count: session.studentCount })}
      </p>
    </Card>
  );
}
