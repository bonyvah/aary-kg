"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { ClipboardText } from "@phosphor-icons/react/ssr";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { RowNumberTd, RowNumberTh, Table, Td, Th } from "@/components/ui/Table";
import { listSurveySheets, listSurveys } from "@/lib/api/surveys";
import { useDateTime } from "@/lib/useDateTime";
import type { SurveySheetSummary, SurveySummary } from "@/types/survey";
import { FilteredList } from "./FilteredList";
import { ResourceView, useResource } from "./Resource";
import { SurveyStatusBadge } from "./SurveyStatusBadge";

const LINK =
  "break-words underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

// Rows per page in the surveys table.
const PAGE = 20;

/** The Surveys tab: the surveys run, and for admins the sheets to write and run. The superadmin only reads. */
export function SurveysPanel({ superadmin }: { superadmin: boolean }) {
  return (
    <div className="flex flex-col gap-8">
      <SurveysSection canStart={!superadmin} />
      {superadmin ? null : <SheetsSection />}
    </div>
  );
}

function SurveysSection({ canStart }: { canStart: boolean }) {
  const t = useTranslations("admin.surveys");
  const surveys = useResource(listSurveys);
  return (
    <section className="flex flex-col gap-4" aria-labelledby="surveys-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="surveys-title" className="text-h2 font-black">
          {t("list.title")}
        </h2>
        {canStart ? (
          <ButtonLink href="/admin/surveys/new" variant="primary">
            {t("list.start")}
          </ButtonLink>
        ) : null}
      </div>
      <ResourceView resource={surveys} inline>
        {(items) => (
          <FilteredList
            items={items}
            fields={{ text: (s) => [s.title, ...s.groupNames], date: (s) => s.openedAt }}
            pageSize={PAGE}
            empty={<SurveysTable surveys={[]} />}
          >
            {(page, first) => <SurveysTable surveys={page} first={first} />}
          </FilteredList>
        )}
      </ResourceView>
    </section>
  );
}

function SurveysTable({ surveys, first = 1 }: { surveys: readonly SurveySummary[]; first?: number }) {
  const t = useTranslations("admin.surveys.list");
  const format = useFormatter();
  const dateTime = useDateTime();
  if (surveys.length === 0) return <EmptyState icon={ClipboardText} title={t("empty")} />;
  return (
    <Table className="min-w-[760px]">
      <thead>
        <tr>
          <RowNumberTh />
          <Th>{t("name")}</Th>
          <Th>{t("groups")}</Th>
          <Th>{t("opened")}</Th>
          <Th>{t("status")}</Th>
          <Th className="text-right">{t("answered")}</Th>
        </tr>
      </thead>
      <tbody>
        {surveys.map((survey, index) => (
          <tr key={survey.id}>
            <RowNumberTd number={first + index} />
            <Td className="font-bold">
              <Link href={`/admin/surveys/${survey.id}`} className={LINK}>
                {survey.title}
              </Link>
            </Td>
            <Td>{survey.groupNames.join(", ")}</Td>
            <Td className="whitespace-nowrap">{dateTime(new Date(survey.openedAt))}</Td>
            <Td>
              <SurveyStatusBadge status={survey.status} />
            </Td>
            <Td className="text-right whitespace-nowrap tabular-nums">
              {format.number(survey.answeredCount)} / {format.number(survey.studentCount)}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function SheetsSection() {
  const t = useTranslations("admin.surveys");
  const sheets = useResource(listSurveySheets);
  return (
    <section className="flex flex-col gap-4" aria-labelledby="survey-sheets-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="survey-sheets-title" className="text-h2 font-black">
          {t("sheets.title")}
        </h2>
        <ButtonLink href="/admin/surveys/sheets/new" variant="success">
          {t("sheets.new")}
        </ButtonLink>
      </div>
      <ResourceView resource={sheets} inline>
        {(items) => <SheetsTable sheets={items} />}
      </ResourceView>
    </section>
  );
}

function SheetsTable({ sheets }: { sheets: readonly SurveySheetSummary[] }) {
  const t = useTranslations("admin.surveys.sheets");
  const format = useFormatter();
  if (sheets.length === 0) return <EmptyState icon={ClipboardText} title={t("empty")} />;
  return (
    <Table className="min-w-[560px]">
      <thead>
        <tr>
          <RowNumberTh />
          <Th>{t("name")}</Th>
          <Th className="text-right">{t("questions")}</Th>
        </tr>
      </thead>
      <tbody>
        {sheets.map((sheet, index) => (
          <tr key={sheet.id}>
            <RowNumberTd number={index + 1} />
            <Td className="font-bold">
              <Link href={`/admin/surveys/sheets/${sheet.id}`} className={LINK}>
                {sheet.title}
              </Link>
            </Td>
            <Td className="text-right tabular-nums">{format.number(sheet.questionCount)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
