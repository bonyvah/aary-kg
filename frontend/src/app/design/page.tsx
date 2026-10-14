import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import { Gallery } from "./Gallery";

export default function DesignPage() {
  const t = useTranslations("design");

  return (
    <main className="flex flex-col">
      <header className="flex flex-col gap-4 bg-surface p-6">
        <h1 className="text-h1 font-black">{t("title")}</h1>
        <p className="max-w-[720px] text-body-lg text-ink-muted">{t("intro")}</p>
        <LocaleSwitcher />
      </header>
      <section className="bg-surface p-6 text-ink">
        <h2 className="mb-6 text-overline font-bold uppercase text-ink-muted">{t("theme.light")}</h2>
        <Gallery />
      </section>
      <section data-theme="game" className="bg-surface p-6 text-ink">
        <h2 className="mb-6 text-overline font-bold uppercase text-ink-muted">{t("theme.game")}</h2>
        <Gallery />
      </section>
    </main>
  );
}
