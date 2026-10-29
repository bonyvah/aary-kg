import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ImageFrame } from "@/components/ui/ImageFrame";
import type { QuizSummary } from "@/types/quiz";

/** The whole card is the link: the title is the link and its hit area is stretched over the card. */
export function QuizCard({ quiz }: { quiz: QuizSummary }) {
  const t = useTranslations("staff.dashboard");

  return (
    <Card
      className={
        "relative flex h-full min-h-[116px] flex-col gap-2 overflow-hidden transition-[transform,box-shadow] duration-150 ease-out " +
        "hover:-translate-y-px hover:shadow-[0_5px_0_0_var(--border)] " +
        "focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-focus-ring"
      }
    >
      <ImageFrame image={quiz.image} placeholder className="-mx-6 -mt-6 mb-2" />
      {quiz.status === "draft" ? (
        <div>
          <Badge>{t("draft")}</Badge>
        </div>
      ) : null}
      <h2 title={quiz.title} className="line-clamp-2 text-h3 font-bold [overflow-wrap:anywhere]">
        <Link href={`/quizzes/view/${quiz.id}`} className="outline-none after:absolute after:inset-0 after:content-['']">
          {quiz.title}
        </Link>
      </h2>
      <p className="mt-auto text-body text-ink-muted">{t("questionCount", { count: quiz.questionCount })}</p>
    </Card>
  );
}
