import { search } from "@/lib/search";

/** What the list filters hold: a search, a host ("" = anyone) and a day range ("" = open, "YYYY-MM-DD"). */
export type ListFilter = { query: string; host: string; from: string; to: string };

export const EMPTY_FILTER: ListFilter = { query: "", host: "", from: "", to: "" };

export type ListFields<T> = {
  /** The texts searched: a title, a host's name... */
  text: (item: T) => string[];
  /** The host's name, for the host filter. */
  host?: (item: T) => string;
  /** The ISO date-time the date range applies to. */
  date?: (item: T) => string;
};

/** The day of an ISO date-time in the reader's time zone, as YYYY-MM-DD (what a date field holds). */
export function localDay(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The items that pass the host and the day range, then the search (best first). */
export function applyFilter<T>(items: readonly T[], filter: ListFilter, fields: ListFields<T>): T[] {
  const kept = items.filter((item) => {
    if (filter.host && fields.host && fields.host(item) !== filter.host) return false;
    if (fields.date && (filter.from || filter.to)) {
      const day = localDay(fields.date(item));
      if (filter.from && day < filter.from) return false;
      if (filter.to && day > filter.to) return false;
    }
    return true;
  });
  return search(kept, filter.query, fields.text);
}

/** The hosts in a list, sorted by name, for the host filter. */
export function hostsOf<T>(items: readonly T[], host: (item: T) => string, locale: string): string[] {
  return Array.from(new Set(items.map(host))).sort((a, b) => a.localeCompare(b, locale));
}

/** One page of a list. Pages count from 1; a page past the end shows the last one. */
export function pageOf<T>(items: readonly T[], page: number, size: number): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pages);
  return { items: items.slice((current - 1) * size, current * size), page: current, pages };
}
