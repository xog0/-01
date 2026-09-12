import type { Metadata } from "next";
import { OpportunitiesExplorer } from "@/components/site/OpportunitiesExplorer";
import { PageHeader } from "@/components/ui/PageHeader";
import { getOpportunities } from "@/lib/data";
import { getDictionary } from "@/lib/i18n";
import { defaultLocale, isLocale } from "@/lib/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const dict = getDictionary(locale);
  return { title: dict.opportunities.title, description: dict.opportunities.subtitle };
}

export default async function OpportunitiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const dict = getDictionary(locale);
  const items = await getOpportunities();

  return (
    <>
      <PageHeader
        eyebrow={dict.nav.opportunities}
        title={dict.opportunities.title}
        subtitle={dict.opportunities.subtitle}
      />
      <section className="section">
        <div className="container-page">
          <OpportunitiesExplorer items={items} locale={locale} dict={dict} />
        </div>
      </section>
    </>
  );
}
