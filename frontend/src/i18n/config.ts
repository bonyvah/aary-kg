export const locales = ["ky", "ru"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ky";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: string | undefined): value is Locale {
  return locales.some((locale) => locale === value);
}
