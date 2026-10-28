"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MagnifyingGlass } from "@phosphor-icons/react/ssr";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { hostsOf, type ListFields } from "@/lib/listFilter";
import { useFilteredList } from "@/lib/useFilteredList";
import { ListFilters } from "./ListFilters";

type FilteredListProps<T> = {
  items: readonly T[];
  fields: ListFields<T>;
  pageSize: number;
  /** Shown when the list itself is empty (no filters then). */
  empty: ReactNode;
  /** Beside the search, e.g. a link to more of the same; shown even when the list is empty. */
  actions?: ReactNode;
  children: (page: T[]) => ReactNode;
};

/** A list with its filters above (search, host, days) and pages below. */
export function FilteredList<T>({ items, fields, pageSize, empty, actions, children }: FilteredListProps<T>) {
  const t = useTranslations("common.filters");
  const locale = useLocale();
  const list = useFilteredList(items, fields, pageSize);
  if (items.length === 0) {
    return actions ? (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">{actions}</div>
        {empty}
      </div>
    ) : (
      <>{empty}</>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ListFilters
        value={list.filter}
        onChange={list.setFilter}
        hosts={fields.host ? hostsOf(items, fields.host, locale) : undefined}
        dates={fields.date !== undefined}
        actions={actions}
      />
      {list.items.length > 0 ? children(list.items) : <EmptyState icon={MagnifyingGlass} title={t("nothingFound")} />}
      <Pagination page={list.page} pages={list.pages} onChange={list.setPage} />
    </div>
  );
}
