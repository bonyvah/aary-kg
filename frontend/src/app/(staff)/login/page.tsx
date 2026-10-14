import { useTranslations } from "next-intl";

export default function LoginPage() {
  const t = useTranslations("staff.login");
  return <h1>{t("title")}</h1>;
}
