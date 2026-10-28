"use client";

import { useTranslations } from "next-intl";
import { Input, SearchInput } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { ListFilter } from "@/lib/listFilter";

type ListFiltersProps = {
  value: ListFilter;
  onChange: (filter: ListFilter) => void;
  /** Hosts to pick from; left out (or one host only): no host filter. */
  hosts?: readonly string[];
  /** The date range filter. */
  dates?: boolean;
};

/** A search, a host and a day range above a list. */
export function ListFilters({ value, onChange, hosts = [], dates = true }: ListFiltersProps) {
  const t = useTranslations("common.filters");
  const set = (change: Partial<ListFilter>) => onChange({ ...value, ...change });

  return (
    <div className="flex flex-wrap items-end gap-4">
      <SearchInput label={t("search")} value={value.query} onChange={(event) => set({ query: event.target.value })} wrapperClassName="w-full max-w-[360px]" />
      {hosts.length > 1 ? (
        <Select label={t("host")} value={value.host} onChange={(event) => set({ host: event.target.value })} wrapperClassName="w-full max-w-[240px]">
          <option value="">{t("anyHost")}</option>
          {hosts.map((host) => (
            <option key={host} value={host}>
              {host}
            </option>
          ))}
        </Select>
      ) : null}
      {dates ? (
        <>
          <Input type="date" label={t("from")} value={value.from} max={value.to || undefined} onChange={(event) => set({ from: event.target.value })} wrapperClassName="w-full max-w-[200px]" />
          <Input type="date" label={t("to")} value={value.to} min={value.from || undefined} onChange={(event) => set({ to: event.target.value })} wrapperClassName="w-full max-w-[200px]" />
        </>
      ) : null}
    </div>
  );
}
