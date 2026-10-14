import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { Montserrat } from "next/font/google";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["500", "700", "900"],
  variable: "--font-montserrat",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return { title: t("name") };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={montserrat.variable}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
