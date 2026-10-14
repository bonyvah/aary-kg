"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, locales, type Locale } from "@/i18n/config";
import { Button } from "./Button";

// Language names are shown in their own language, so they are not translated.
const names: Record<Locale, string> = { ky: "Кыргызча", ru: "Русский" };
const ONE_YEAR = 60 * 60 * 24 * 365;

export function LocaleSwitcher() {
  const current = useLocale();
  const t = useTranslations("common");
  const router = useRouter();

  function select(locale: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    router.refresh();
  }

  return (
    <div role="group" aria-label={t("language")} className="flex flex-wrap gap-2">
      {locales.map((locale) => (
        <Button
          key={locale}
          variant={locale === current ? "primary" : "neutral"}
          aria-pressed={locale === current}
          onClick={() => select(locale)}
        >
          {names[locale]}
        </Button>
      ))}
    </div>
  );
}
