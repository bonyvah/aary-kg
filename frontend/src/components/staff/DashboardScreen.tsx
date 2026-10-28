"use client";

import { useId } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ClockCounterClockwise, Exam, Files, Question, Trophy } from "@phosphor-icons/react/ssr";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { useStoredTab } from "@/lib/useStoredTab";
import { Tabs, panelId, tabId } from "@/components/ui/Tabs";
import { listContests } from "@/lib/api/contests";
import { listExams } from "@/lib/api/exams";
import { listExamSessions } from "@/lib/api/examSessions";
import { listGames } from "@/lib/api/games";
import { listQuizzes } from "@/lib/api/quizzes";
import { ContestCard } from "./ContestCard";
import { DraftCard } from "./DraftCard";
import { FilteredList } from "./FilteredList";
import { ExamCard } from "./ExamCard";
import { ExamSessionCard } from "./ExamSessionCard";
import { GameCard } from "./GameCard";
import { ResourceView, useResource } from "./Resource";
import { useCurrentUser } from "./SessionProvider";
import { QuizCard } from "./QuizCard";
import { StaffMenu } from "./StaffMenu";
import { StaffShell } from "./StaffShell";

// Three rows of cards on a wide screen.
const PAGE_SIZE = 12;

const TABS = ["quizzes", "examSheets", "exams", "contests", "games"] as const;
type Tab = (typeof TABS)[number];

function Grid<T extends { id: string }>({ items, render }: { items: readonly T[]; render: (item: T) => ReactNode }) {
  return (
    <ul className="grid auto-rows-fr gap-4 pb-1 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.id} className="flex">
          <div className="flex-1">{render(item)}</div>
        </li>
      ))}
    </ul>
  );
}

export function DashboardScreen() {
  const user = useCurrentUser();
  const t = useTranslations("staff.dashboard");
  const [tab, setTab] = useStoredTab<Tab>("aary.dashboardTab", TABS, "quizzes");
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
          onChange={setTab}
          className="max-w-[720px] flex-1"
        />
        {tab === "quizzes" ? (
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/quizzes/library" variant="secondary">
              {t("library")}
            </ButtonLink>
            <ButtonLink href="/quizzes/manage/new" variant="success">
              {t("createQuiz")}
            </ButtonLink>
          </div>
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
      <div id={panelId(idBase)} role="tabpanel" aria-labelledby={tabId(idBase, tab)}>
        {tab === "quizzes" ? (
          <div className="flex flex-col gap-4">
          <DraftCard kind="quiz" />
          <ResourceView resource={quizzes} inline>
            {(all) => (
              <FilteredList
                key="quizzes"
                items={all}
                fields={{ text: (quiz) => [quiz.title] }}
                pageSize={PAGE_SIZE}
                empty={<EmptyState icon={Question} title={t("quizzesEmpty.title")} description={t("quizzesEmpty.description")} />}
              >
                {(page) => <Grid items={page} render={(quiz) => <QuizCard quiz={quiz} />} />}
              </FilteredList>
            )}
          </ResourceView>
          </div>
        ) : tab === "examSheets" ? (
          <div className="flex flex-col gap-4">
          <DraftCard kind="exam" />
          <ResourceView resource={examSheets} inline>
            {(all) => (
              <FilteredList
                key="examSheets"
                items={all}
                fields={{ text: (exam) => [exam.title] }}
                pageSize={PAGE_SIZE}
                empty={<EmptyState icon={Files} title={t("examSheetsEmpty")} />}
              >
                {(page) => <Grid items={page} render={(exam) => <ExamCard exam={exam} />} />}
              </FilteredList>
            )}
          </ResourceView>
          </div>
        ) : tab === "exams" ? (
          <ResourceView resource={exams} inline>
            {(all) => (
              <FilteredList
                key="exams"
                items={all}
                fields={{ text: (session) => [session.title, ...session.groupNames], date: (session) => session.openedAt }}
                pageSize={PAGE_SIZE}
                empty={<EmptyState icon={Exam} title={t("examsEmpty")} />}
              >
                {(page) => <Grid items={page} render={(session) => <ExamSessionCard session={session} />} />}
              </FilteredList>
            )}
          </ResourceView>
        ) : tab === "games" ? (
          <ResourceView resource={games} inline>
            {(all) => (
              <FilteredList
                key="games"
                items={all}
                fields={{ text: (game) => [game.quizTitle], date: (game) => game.finishedAt }}
                pageSize={PAGE_SIZE}
                empty={<EmptyState icon={ClockCounterClockwise} title={t("gamesEmpty.title")} description={t("gamesEmpty.description")} />}
              >
                {(page) => <Grid items={page} render={(game) => <GameCard game={game} />} />}
              </FilteredList>
            )}
          </ResourceView>
        ) : (
          <ResourceView resource={contests} inline>
            {(all) => (
              <FilteredList
                key="contests"
                items={all}
                fields={{
                  text: (contest) => [contest.title, contest.ownerName],
                  host: (contest) => contest.ownerName,
                  date: (contest) => contest.createdAt,
                }}
                pageSize={PAGE_SIZE}
                empty={<EmptyState icon={Trophy} title={t("contestsEmpty.title")} description={t("contestsEmpty.description")} />}
              >
                {(page) => <Grid items={page} render={(contest) => <ContestCard contest={contest} userId={user.id} />} />}
              </FilteredList>
            )}
          </ResourceView>
        )}
      </div>
    </StaffShell>
  );
}
