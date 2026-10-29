"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Books } from "@phosphor-icons/react/ssr";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { ImageFrame } from "@/components/ui/ImageFrame";
import { EmptyState } from "@/components/ui/EmptyState";
import { listLibrary, type LibraryQuizSummary } from "@/lib/api/quizzes";
import { FilteredList } from "./FilteredList";
import { ResourceView, useResource } from "./Resource";
import { StaffMenu } from "./StaffMenu";
import { StaffShell } from "./StaffShell";

const PAGE_SIZE = 12;

/** /quizzes/library: other teachers' quizzes, to read and copy. */
export function QuizLibraryScreen() {
  const t = useTranslations("staff.library");
  const quizzes = useResource(listLibrary);

  return (
    <StaffShell
      topRight={
        <div className="flex items-center gap-3">
          <ButtonLink href="/dashboard" variant="neutral">
            {t("back")}
          </ButtonLink>
          <StaffMenu />
        </div>
      }
    >
      <h1 className="text-h1 font-black">{t("title")}</h1>
      <ResourceView resource={quizzes} inline>
        {(all) => (
          <FilteredList
            items={all}
            fields={{ text: (q) => [q.title, q.ownerName], host: (q) => q.ownerName }}
            pageSize={PAGE_SIZE}
            empty={<EmptyState icon={Books} title={t("empty")} />}
          >
            {(page) => (
              <ul className="grid auto-rows-fr gap-4 pb-1 sm:grid-cols-2 lg:grid-cols-3">
                {page.map((quiz) => (
                  <li key={quiz.id} className="flex">
                    <LibraryCard quiz={quiz} />
                  </li>
                ))}
              </ul>
            )}
          </FilteredList>
        )}
      </ResourceView>
    </StaffShell>
  );
}

function LibraryCard({ quiz }: { quiz: LibraryQuizSummary }) {
  const t = useTranslations("staff.dashboard");
  return (
    <Card
      className={
        "relative flex h-full min-h-[116px] flex-1 flex-col gap-2 overflow-hidden transition-[transform,box-shadow] duration-150 ease-out " +
        "hover:-translate-y-px hover:shadow-[0_5px_0_0_var(--border)] " +
        "focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-focus-ring"
      }
    >
      <ImageFrame image={quiz.image} placeholder className="-mx-6 -mt-6 mb-2" />
      <h2 title={quiz.title} className="line-clamp-2 text-h3 font-bold [overflow-wrap:anywhere]">
        <Link href={`/quizzes/library/${quiz.id}`} className="outline-none after:absolute after:inset-0 after:content-['']">
          {quiz.title}
        </Link>
      </h2>
      <p className="text-body font-bold [overflow-wrap:anywhere]">{quiz.ownerName}</p>
      <p className="mt-auto text-body text-ink-muted">{t("questionCount", { count: quiz.questionCount })}</p>
    </Card>
  );
}
