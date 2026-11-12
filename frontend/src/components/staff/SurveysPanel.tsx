"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { ClipboardText } from "@phosphor-icons/react/ssr";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { RowNumberTd, RowNumberTh, Table, Td, Th } from "@/components/ui/Table";
import { listSurveySheets } from "@/lib/api/surveys";
import type { SurveySheetSummary } from "@/types/survey";
import { ResourceView, useResource } from "./Resource";

/** The admin's Surveys tab: the sheets to write and run. */
export function SurveysPanel({ superadmin }: { superadmin: boolean }) {
  return <div className="flex flex-col gap-8">{superadmin ? null : <SheetsSection />}</div>;
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
              <Link
                href={`/admin/surveys/sheets/${sheet.id}`}
                className="break-words underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
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
