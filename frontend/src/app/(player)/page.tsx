import { useTranslations } from "next-intl";

export default function PlayerHomePage() {
  const t = useTranslations("player.home");
  return <h1>{t("title")}</h1>;
}
