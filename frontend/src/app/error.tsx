"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ErrorPage } from "@/components/ui/ErrorPage";

/** A screen crashed while rendering. The rest of the app (the layout, the language) still works. */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errorPage");
  return (
    <ErrorPage
      title={t("error.title")}
      description={t("error.description")}
      action={
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>{t("retry")}</Button>
          <ButtonLink href="/" variant="neutral">
            {t("home")}
          </ButtonLink>
        </div>
      }
    />
  );
}
