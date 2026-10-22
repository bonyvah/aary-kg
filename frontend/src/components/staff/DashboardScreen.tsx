"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { ClockCounterClockwise, Exam, Question, Trophy } from "@phosphor-icons/react/ssr";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs, panelId, tabId } from "@/components/ui/Tabs";
import { listContests } from "@/lib/api/contests";
import { listExams } from "@/lib/api/exams";
import { listGames } from "@/lib/api/games";
import { listQuizzes } from "@/lib/api/quizzes";
import { ContestCard } from "./ContestCard";
import { ExamCard } from "./ExamCard";
import { GameCard } from "./GameCard";
import { ResourceView, useResource } from "./Resource";
import { useCurrentUser } from "./SessionProvider";
import { QuizCard } from "./QuizCard";
import { StaffMenu } from "./StaffMenu";
import { StaffShell } from "./StaffShell";

const TABS = ["quizzes", "exams", "contests", "games"] as const;
type Tab = (typeof TABS)[number];

export function DashboardScreen() {
  const user = useCurrentUser();
  const t = useTranslations("staff.dashboard");
  const [tab, setTab] = useState<Tab>("quizzes");
  const idBase = useId();
  const quizzes = useResource(listQuizzes);
  const exams = useResource(listExams);
  const contests = useResource(listContests);
  const games = useResource(listGames);

  return (
    <StaffShell
      topRight={
        <div className="flex items-center gap-3">
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
          className="max-w-[480px] flex-1"
        />
        {tab === "quizzes" ? (
          <ButtonLink href="/quizzes/manage/new" variant="success">
            {t("createQuiz")}
          </ButtonLink>
        ) : tab === "exams" ? (
          <ButtonLink href="/exams/manage/new" variant="success">
            {t("createExam")}
          </ButtonLink>
        ) : tab === "contests" ? (
          <ButtonLink href="/contests/new" variant="success">
            {t("createContest")}
          </ButtonLink>
        ) : null}
      </div>
      <div id={panelId(idBase)} role="tabpanel" aria-labelledby={tabId(idBase, tab)}>
        {tab === "quizzes" ? (
          <ResourceView resource={quizzes} inline>
            {(items) =>
              items.length > 0 ? (
                <ul className="grid auto-rows-fr gap-4 pb-1 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((quiz) => (
                    <li key={quiz.id} className="flex">
                      <div className="flex-1">
                        <QuizCard quiz={quiz} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={Question} title={t("quizzesEmpty.title")} description={t("quizzesEmpty.description")} />
              )
            }
          </ResourceView>
        ) : tab === "exams" ? (
          <ResourceView resource={exams} inline>
            {(items) =>
              items.length > 0 ? (
                <ul className="grid auto-rows-fr gap-4 pb-1 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((exam) => (
                    <li key={exam.id} className="flex">
                      <div className="flex-1">
                        <ExamCard exam={exam} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={Exam} title={t("examsEmpty")} />
              )
            }
          </ResourceView>
        ) : tab === "games" ? (
          <ResourceView resource={games} inline>
            {(items) =>
              items.length > 0 ? (
                <ul className="grid auto-rows-fr gap-4 pb-1 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((game) => (
                    <li key={game.id} className="flex">
                      <div className="flex-1">
                        <GameCard game={game} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={ClockCounterClockwise} title={t("gamesEmpty.title")} description={t("gamesEmpty.description")} />
              )
            }
          </ResourceView>
        ) : (
          <ResourceView resource={contests} inline>
            {(items) =>
              items.length > 0 ? (
                <ul className="grid auto-rows-fr gap-4 pb-1 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((contest) => (
                    <li key={contest.id} className="flex">
                      <div className="flex-1">
                        <ContestCard contest={contest} userId={user.id} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={Trophy} title={t("contestsEmpty.title")} description={t("contestsEmpty.description")} />
              )
            }
          </ResourceView>
        )}
      </div>
    </StaffShell>
  );
}
