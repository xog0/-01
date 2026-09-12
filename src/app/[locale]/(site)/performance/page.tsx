import type { Metadata } from "next";
import { AllocationBar } from "@/components/charts/AllocationBar";
import { NavTrendChart } from "@/components/charts/NavTrendChart";
import { ReturnsBarChart } from "@/components/charts/ReturnsBarChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Stat } from "@/components/ui/Stat";
import { getAllocation, getAnnualReturns, getKpis, getNavSeries } from "@/lib/data";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/format";
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
  return { title: dict.performance.title, description: dict.performance.subtitle };
}

export default async function PerformancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const dict = getDictionary(locale);

  const [kpis, navSeries, allocation, annual] = await Promise.all([
    getKpis(),
    getNavSeries(),
    getAllocation(),
    getAnnualReturns(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={dict.nav.performance}
        title={dict.performance.title}
        subtitle={dict.performance.subtitle}
      />

      <section className="section">
        <div className="container-page">
          <p className="text-xs text-muted">
            {dict.common.updated}: {formatDate(kpis.as_of, locale)}
          </p>

          <dl className="mt-6 grid gap-8 rounded-2xl border border-line bg-white p-8 sm:grid-cols-2 lg:grid-cols-3">
            <Stat
              label={dict.performance.kpis.nav}
              value={formatCurrency(kpis.nav, locale, { compact: true })}
            />
            <Stat
              label={dict.performance.kpis.irr}
              value={formatPercent(kpis.irr, locale, 1)}
            />
            <Stat
              label={dict.performance.kpis.yield}
              value={formatPercent(kpis.cash_yield, locale, 1)}
            />
            <Stat
              label={dict.performance.kpis.drawdown}
              value={formatPercent(kpis.max_drawdown, locale, 1)}
            />
            <Stat
              label={dict.performance.kpis.deals}
              value={formatNumber(kpis.deals, locale)}
            />
            <Stat
              label={dict.performance.kpis.exits}
              value={formatNumber(kpis.exits, locale)}
            />
          </dl>
        </div>
      </section>

      <section className="pb-4">
        <div className="container-page">
          <div className="card p-7 md:p-9">
            <SectionHeading
              title={dict.performance.navTitle}
              subtitle={dict.performance.navSubtitle}
            />
            <div className="mt-8">
              <NavTrendChart
                data={navSeries}
                locale={locale}
                valueLabel={dict.performance.navTitle}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-page grid gap-6 lg:grid-cols-2">
          <div className="card p-7 md:p-9">
            <SectionHeading
              title={dict.performance.allocationTitle}
              subtitle={dict.performance.allocationSubtitle}
            />
            <div className="mt-8">
              <AllocationBar data={allocation} labels={dict.sectors} locale={locale} />
            </div>
          </div>

          <div className="card p-7 md:p-9">
            <SectionHeading
              title={dict.performance.annualTitle}
              subtitle={dict.performance.annualSubtitle}
            />
            <div className="mt-8">
              <ReturnsBarChart
                data={annual}
                locale={locale}
                label={dict.performance.annualTitle}
              />
            </div>
          </div>
        </div>

        <div className="container-page mt-8">
          <p className="rounded-xl border border-line bg-paper-2/70 p-5 text-xs leading-relaxed text-muted">
            {dict.performance.disclaimer}
          </p>
        </div>
      </section>
    </>
  );
}
