import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import type { ExamSummary } from "@/types/exam";

/** The whole card is the link: the title is the link and its hit area is stretched over the card. */
export function ExamCard({ exam }: { exam: ExamSummary }) {
  const t = useTranslations("staff.dashboard");

  return (
    <Card
      className={
        "relative flex h-full min-h-[116px] flex-col gap-2 transition-[transform,box-shadow] duration-150 ease-out " +
        "hover:-translate-y-px hover:shadow-[0_5px_0_0_var(--border)] " +
        "focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-focus-ring"
      }
    >
      <h2 title={exam.title} className="line-clamp-2 text-h3 font-bold [overflow-wrap:anywhere]">
        <Link href={`/exams/manage/${exam.id}`} className="outline-none after:absolute after:inset-0 after:content-['']">
          {exam.title}
        </Link>
      </h2>
      <p className="mt-auto text-body text-ink-muted">
        {t("examMeta", { count: exam.questionCount, minutes: exam.minutes })}
      </p>
    </Card>
  );
}
