import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ErrorPage } from "@/components/ui/ErrorPage";

export default async function NotFound() {
  const t = await getTranslations("errorPage");
  return (
    <ErrorPage
      title={t("notFound.title")}
      description={t("notFound.description")}
      action={<ButtonLink href="/">{t("home")}</ButtonLink>}
    />
  );
}
