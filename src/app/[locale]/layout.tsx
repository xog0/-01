import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { getDictionary } from "@/lib/i18n";
import { isLocale, localeDirection, locales } from "@/lib/i18n/config";
import { siteConfig } from "@/lib/site.config";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);

  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: `${siteConfig.name[locale]} — ${siteConfig.tagline[locale]}`,
      template: `%s — ${siteConfig.name[locale]}`,
    },
    description: dict.meta.description,
    alternates: {
      canonical: `/${locale}`,
      languages: { ar: "/ar", en: "/en" },
    },
    openGraph: {
      type: "website",
      locale: siteConfig.locale[locale],
      siteName: siteConfig.name[locale],
      title: `${siteConfig.name[locale]} — ${siteConfig.tagline[locale]}`,
      description: dict.meta.description,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale} dir={localeDirection[locale]} className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
