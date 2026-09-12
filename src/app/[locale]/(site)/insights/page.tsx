import type { Metadata } from "next";
import { InsightsExplorer } from "@/components/site/InsightsExplorer";
import { PageHeader } from "@/components/ui/PageHeader";
import { getPosts } from "@/lib/data";
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
  return { title: dict.insights.title, description: dict.insights.subtitle };
}

export default async function InsightsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const dict = getDictionary(locale);
  const posts = await getPosts();

  return (
    <>
      <PageHeader
        eyebrow={dict.nav.insights}
        title={dict.insights.title}
        subtitle={dict.insights.subtitle}
      />
      <section className="section">
        <div className="container-page">
          <InsightsExplorer posts={posts} locale={locale} dict={dict} />
        </div>
      </section>
    </>
  );
}
