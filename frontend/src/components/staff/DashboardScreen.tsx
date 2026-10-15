"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Trophy } from "@phosphor-icons/react/ssr";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs, panelId, tabId } from "@/components/ui/Tabs";
import { mockCurrentUser } from "@/mocks/staff";
import { useCurrentUser } from "./SessionProvider";
import { contestsForUser } from "@/mocks/contests";
import { mockQuizSummaries } from "@/mocks/quizzes";
import { ContestCard } from "./ContestCard";
import { QuizCard } from "./QuizCard";
import { StaffMenu } from "./StaffMenu";
import { StaffShell } from "./StaffShell";

const TABS = ["quizzes", "contests"] as const;
type Tab = (typeof TABS)[number];

export function DashboardScreen() {
  const user = useCurrentUser();
  const t = useTranslations("staff.dashboard");
  const [tab, setTab] = useState<Tab>("quizzes");
  const idBase = useId();
  const contests = contestsForUser(mockCurrentUser.id);

  return (
    <StaffShell
      topRight={
        <div className="flex items-center gap-3">
          {user.role === "admin" ? (
            <ButtonLink href="/admin" variant="neutral">
              {t("admin")}
            </ButtonLink>
          ) : null}
          <StaffMenu />
        </div>
      }
    >
      <h1 className="sr-only">{t("title")}</h1>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs
          idBase={idBase}
          label={t("tabsLabel")}
          tabs={TABS.map((id) => ({ id, label: t(`tabs.${id}`) }))}
          value={tab}
          onChange={setTab}
          className="max-w-[360px] flex-1"
        />
        {tab === "quizzes" ? (
          <ButtonLink href="/quizzes/new" variant="accent">
            {t("createQuiz")}
          </ButtonLink>
        ) : (
          <ButtonLink href="/contests/new" variant="accent">
            {t("createContest")}
          </ButtonLink>
        )}
      </div>
      <div id={panelId(idBase)} role="tabpanel" aria-labelledby={tabId(idBase, tab)}>
        {tab === "quizzes" ? (
          <ul className="grid gap-4 pb-1 sm:grid-cols-2 lg:grid-cols-3">
            {mockQuizSummaries.map((quiz) => (
              <li key={quiz.id} className="flex">
                <div className="flex-1">
                  <QuizCard quiz={quiz} />
                </div>
              </li>
            ))}
          </ul>
        ) : contests.length > 0 ? (
          <ul className="grid gap-4 pb-1 sm:grid-cols-2 lg:grid-cols-3">
            {contests.map((contest) => (
              <li key={contest.id} className="flex">
                <div className="flex-1">
                  <ContestCard contest={contest} userId={mockCurrentUser.id} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Trophy} title={t("contestsEmpty.title")} description={t("contestsEmpty.description")} />
        )}
      </div>
    </StaffShell>
  );
}
