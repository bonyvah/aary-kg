"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { ClipboardText } from "@phosphor-icons/react/ssr";
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

/** The surveys run. */
export function SurveysList() {
  const surveys = useResource(listSurveys);
  return (
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

/** The sheets (papers) to write and run surveys from. */
export function SheetsList() {
  const sheets = useResource(listSurveySheets);
  return (
    <ResourceView resource={sheets} inline>
      {(items) => <SheetsTable sheets={items} />}
    </ResourceView>
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
