"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ClockCounterClockwise, Exam, Files, MagnifyingGlass, Question, Trophy } from "@phosphor-icons/react/ssr";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/Input";
import { matches } from "@/lib/search";
import { Tabs, panelId, tabId } from "@/components/ui/Tabs";
import { listContests } from "@/lib/api/contests";
import { listExams } from "@/lib/api/exams";
import { listExamSessions } from "@/lib/api/examSessions";
import { listGames } from "@/lib/api/games";
import { listQuizzes } from "@/lib/api/quizzes";
import { ContestCard } from "./ContestCard";
import { ExamCard } from "./ExamCard";
import { ExamSessionCard } from "./ExamSessionCard";
import { GameCard } from "./GameCard";
import { ResourceView, useResource } from "./Resource";
import { useCurrentUser } from "./SessionProvider";
import { QuizCard } from "./QuizCard";
import { StaffMenu } from "./StaffMenu";
import { StaffShell } from "./StaffShell";

const TABS = ["quizzes", "examSheets", "exams", "contests", "games"] as const;
type Tab = (typeof TABS)[number];

export function DashboardScreen() {
  const user = useCurrentUser();
  const t = useTranslations("staff.dashboard");
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>("quizzes");
  const [query, setQuery] = useState("");
  const searchable = tab === "quizzes" || tab === "examSheets";
  const idBase = useId();
  const quizzes = useResource(listQuizzes);
  const examSheets = useResource(listExams);
  const exams = useResource(listExamSessions);
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
          onChange={(next) => {
            setTab(next);
            setQuery("");
          }}
          className="max-w-[720px] flex-1"
        />
        {tab === "quizzes" ? (
          <ButtonLink href="/quizzes/manage/new" variant="success">
            {t("createQuiz")}
          </ButtonLink>
        ) : tab === "examSheets" ? (
          <ButtonLink href="/exams/manage/new" variant="success">
            {t("createExamSheet")}
          </ButtonLink>
        ) : tab === "exams" ? (
          <ButtonLink href="/exam-sessions/new" variant="success">
            {t("startExam")}
          </ButtonLink>
        ) : tab === "contests" ? (
          <ButtonLink href="/contests/new" variant="success">
            {t("createContest")}
          </ButtonLink>
        ) : null}
      </div>
      {searchable ? (
        <SearchInput label={t("search")}
          placeholder={t("search")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          wrapperClassName="w-full max-w-[420px]"
        />
      ) : null}
      <div id={panelId(idBase)} role="tabpanel" aria-labelledby={tabId(idBase, tab)}>
        {tab === "quizzes" ? (
          <ResourceView resource={quizzes} inline>
            {(all) => {
              const items = all.filter((quiz) => matches(quiz.title, query, locale));
              return items.length > 0 ? (
                <ul className="grid auto-rows-fr gap-4 pb-1 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((quiz) => (
                    <li key={quiz.id} className="flex">
                      <div className="flex-1">
                        <QuizCard quiz={quiz} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : all.length > 0 ? (
                <EmptyState icon={MagnifyingGlass} title={t("nothingFound")} />
              ) : (
                <EmptyState icon={Question} title={t("quizzesEmpty.title")} description={t("quizzesEmpty.description")} />
              );
            }}
          </ResourceView>
        ) : tab === "examSheets" ? (
          <ResourceView resource={examSheets} inline>
            {(all) => {
              const items = all.filter((exam) => matches(exam.title, query, locale));
              return items.length > 0 ? (
                <ul className="grid auto-rows-fr gap-4 pb-1 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((exam) => (
                    <li key={exam.id} className="flex">
                      <div className="flex-1">
                        <ExamCard exam={exam} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : all.length > 0 ? (
                <EmptyState icon={MagnifyingGlass} title={t("nothingFound")} />
              ) : (
                <EmptyState icon={Files} title={t("examSheetsEmpty")} />
              );
            }}
          </ResourceView>
        ) : tab === "exams" ? (
          <ResourceView resource={exams} inline>
            {(items) =>
              items.length > 0 ? (
                <ul className="grid auto-rows-fr gap-4 pb-1 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((session) => (
                    <li key={session.id} className="flex">
                      <div className="flex-1">
                        <ExamSessionCard session={session} />
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
