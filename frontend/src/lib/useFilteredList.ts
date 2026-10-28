"use client";

import { useState } from "react";
import { applyFilter, EMPTY_FILTER, pageOf, type ListFields, type ListFilter } from "@/lib/listFilter";

/** A filter and a page for one list. Changing the filter goes back to the first page. */
export function useFilteredList<T>(items: readonly T[], fields: ListFields<T>, pageSize: number) {
  const [filter, setFilterState] = useState<ListFilter>(EMPTY_FILTER);
  const [page, setPage] = useState(1);
  const matching = applyFilter(items, filter, fields);
  const current = pageOf(matching, page, pageSize);
  return {
    filter,
    setFilter: (next: ListFilter) => {
      setFilterState(next);
      setPage(1);
    },
    /** Whether anything is filtered out (to tell «nothing found» from «nothing yet»). */
    filtering: filter.query.trim() !== "" || filter.host !== "" || filter.from !== "" || filter.to !== "",
    matching,
    ...current,
    setPage,
  };
}
