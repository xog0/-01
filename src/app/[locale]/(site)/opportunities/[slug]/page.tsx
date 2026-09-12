import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OpportunityCard } from "@/components/site/OpportunityCard";
import { ReturnCalculator } from "@/components/site/ReturnCalculator";
import { RiskBadge, StatusBadge } from "@/components/ui/Badge";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { sectorColor } from "@/lib/charts";
import { getOpportunities, getOpportunityBySlug } from "@/lib/data";
import { formatCurrency, formatPercent, whatsappLink } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { defaultLocale, isLocale, locales } from "@/lib/i18n/config";

export async function generateStaticParams() {
  const items = await getOpportunities();
  return locales.flatMap((locale) =>
    items.map((item) => ({ locale, slug: item.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const item = await getOpportunityBySlug(slug);
  if (!item) return {};

  return {
    title: locale === "ar" ? item.title_ar : item.title_en,
    description: locale === "ar" ? item.summary_ar : item.summary_en,
  };
}

export default async function OpportunityPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const dict = getDictionary(locale);

  const item = await getOpportunityBySlug(slug);
  if (!item) notFound();

  const all = await getOpportunities();
  const related = all.filter((other) => other.slug !== item.slug).slice(0, 3);

  const title = locale === "ar" ? item.title_ar : item.title_en;
  const summary = locale === "ar" ? item.summary_ar : item.summary_en;
  const body = locale === "ar" ? item.body_ar : item.body_en;
  const location = locale === "ar" ? item.location_ar : item.location_en;
  const highlights = locale === "ar" ? item.highlights_ar : item.highlights_en;

  const progress = Math.min(100, Math.round((item.raised / item.target_raise) * 100));

  return (
    <>
      <section className="surface-navy">
        <div className="container-page py-14 md:py-18">
          <Link
            href={`/${locale}/opportunities`}
            className="inline-flex items-center gap-2 text-sm text-navy-100/60 transition-colors hover:text-gold-300"
          >
            <span aria-hidden="true" className="rtl:rotate-180">
              ←
            </span>
            {dict.common.backTo} {dict.nav.opportunities}
          </Link>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} label={dict.status[item.status]} onDark />
            <span
              className="badge text-white"
              style={{ backgroundColor: sectorColor[item.sector] }}
            >
              {dict.sectors[item.sector]}
            </span>
            <RiskBadge
              risk={item.risk}
              label={`${dict.opportunities.riskLevel}: ${dict.risk[item.risk]}`}
              onDark
            />
          </div>

          <h1 className="mt-5 max-w-3xl text-3xl font-extrabold text-white md:text-[2.6rem] md:leading-tight">
            {title}
          </h1>
          <p className="mt-2 text-sm text-navy-100/60">
            {dict.opportunities.location}: {location}
          </p>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-navy-100/75">
            {summary}
          </p>

          <dl className="mt-12 grid grid-cols-2 gap-8 border-t border-white/10 pt-8 md:grid-cols-4">
            <div>
              <dt className="text-xs text-navy-100/60">{dict.opportunities.targetReturn}</dt>
              <dd className="tnum mt-1.5 text-2xl font-extrabold text-gold-300">
                {formatPercent(item.target_return, locale, 1)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-navy-100/60">{dict.opportunities.ticket}</dt>
              <dd className="tnum mt-1.5 text-2xl font-extrabold text-white">
                {formatCurrency(item.min_ticket, locale, { compact: true })}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-navy-100/60">{dict.opportunities.horizon}</dt>
              <dd className="tnum mt-1.5 text-2xl font-extrabold text-white">
                {item.horizon_years} {dict.common.years}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-navy-100/60">{dict.opportunities.raised}</dt>
              <dd className="tnum mt-1.5 text-2xl font-extrabold text-white">
                {progress}%
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="section">
        <div className="container-page grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:items-start">
          <div>
            <div className="prose-ar">
              {body.split("\n\n").map((paragraph) => (
                <p key={paragraph.slice(0, 24)}>{paragraph}</p>
              ))}
            </div>

            <h2 className="mt-12 text-xl font-extrabold text-navy-900">
              {dict.opportunities.highlightsTitle}
            </h2>
            <ul className="mt-5 space-y-3">
              {highlights.map((highlight) => (
                <li key={highlight} className="flex gap-3 text-sm leading-relaxed text-navy-800">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold-500"
                  />
                  {highlight}
                </li>
              ))}
            </ul>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24">
            <div className="card p-7">
              <h2 className="text-base font-bold text-navy-900">
                {dict.opportunities.financialsTitle}
              </h2>
              <dl className="mt-5 divide-y divide-line border-t border-line">
                {item.financials.map((row) => (
                  <div
                    key={row.label_en}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <dt className="text-sm text-muted">
                      {locale === "ar" ? row.label_ar : row.label_en}
                    </dt>
                    <dd className="tnum text-sm font-bold text-navy-900">
                      {locale === "ar" ? row.value_ar : row.value_en}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="card p-7">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>{dict.opportunities.raised}</span>
                <span className="tnum font-semibold text-navy-900">
                  {formatCurrency(item.raised, locale, { compact: true })}{" "}
                  {dict.opportunities.of}{" "}
                  {formatCurrency(item.target_raise, locale, { compact: true })}
                </span>
              </div>
              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-paper-2">
                <div
                  className="h-full rounded-full bg-gold-500"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="mt-6 flex flex-col gap-2.5">
                <Link href={`/${locale}/contact`} className="btn btn-navy w-full">
                  {dict.common.requestInvestment}
                </Link>
                <a
                  href={whatsappLink(`${dict.contact.whatsappPrefill} (${title})`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline w-full !py-2.5 text-sm"
                >
                  {dict.common.whatsapp}
                </a>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="pb-4">
        <div className="container-page">
          <ReturnCalculator
            locale={locale}
            dict={dict}
            defaultAmount={item.min_ticket}
            defaultYears={item.horizon_years}
            defaultRate={item.target_return}
          />
        </div>
      </section>

      {related.length > 0 && (
        <section className="section">
          <div className="container-page">
            <SectionHeading title={dict.opportunities.relatedTitle} />
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {related.map((other) => (
                <OpportunityCard
                  key={other.id}
                  item={other}
                  locale={locale}
                  dict={dict}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
