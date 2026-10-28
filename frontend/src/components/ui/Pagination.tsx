"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react/ssr";
import { useTranslations } from "next-intl";
import { Button } from "./Button";

type PaginationProps = {
  page: number;
  pages: number;
  onChange: (page: number) => void;
};

/** Previous, «page of pages», next. Nothing when everything fits on one page. */
export function Pagination({ page, pages, onChange }: PaginationProps) {
  const t = useTranslations("common.pagination");
  if (pages <= 1) return null;
  return (
    <nav aria-label={t("label")} className="flex items-center justify-center gap-4">
      <Button variant="neutral" disabled={page <= 1} aria-label={t("previous")} title={t("previous")} onClick={() => onChange(page - 1)}>
        <CaretLeft weight="bold" size={20} aria-hidden="true" />
      </Button>
      <span className="text-body-lg font-bold tabular-nums" aria-live="polite">
        {t("position", { page, pages })}
      </span>
      <Button variant="neutral" disabled={page >= pages} aria-label={t("next")} title={t("next")} onClick={() => onChange(page + 1)}>
        <CaretRight weight="bold" size={20} aria-hidden="true" />
      </Button>
    </nav>
  );
}
