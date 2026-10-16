"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";

type Options = {
  /** The month in full (default: shortened). */
  long?: boolean;
  /** Add the hour and minute (default: yes). */
  time?: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Dates in the interface language. Some browsers have no Kyrgyz date data and then write the date in
 * English (Chrome on Linux, for one), so there the date is written from the month names in the
 * message files, in the same shape the full data gives: «2026-ж., 16-октябрь 12:43».
 */
export function useDateTime() {
  const locale = useLocale();
  const format = useFormatter();
  const months = useTranslations("common.months");

  return (date: Date, { long = false, time = true }: Options = {}): string => {
    const supported = Intl.DateTimeFormat.supportedLocalesOf(locale).length > 0;
    if (supported || locale !== "ky") {
      // The reader's own time zone: without it the server's (UTC) is used, and the time is hours off.
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return format.dateTime(date, {
        dateStyle: long ? "long" : "medium",
        ...(time ? { timeStyle: "short" } : {}),
        timeZone,
      });
    }
    const full = months(String(date.getMonth() + 1));
    const month = long || full.length <= 3 ? full : `${full.slice(0, 3).toLowerCase()}.`;
    const day = `${date.getFullYear()}-ж., ${date.getDate()}-${long ? full : month}`;
    return time ? `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}` : day;
  };
}
