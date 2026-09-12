import { AllocationBar } from "@/components/charts/AllocationBar";
import { NavTrendChart } from "@/components/charts/NavTrendChart";
import { ReturnsBarChart } from "@/components/charts/ReturnsBarChart";
import { getAllocation, getAnnualReturns, getKpis, getNavSeries } from "@/lib/data";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { defaultLocale, isLocale } from "@/lib/i18n/config";

export default async function AdminPerformancePage({
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

  const tiles = [
    { label: dict.performance.kpis.nav, value: formatCurrency(kpis.nav, locale, { compact: true }) },
    { label: dict.performance.kpis.irr, value: formatPercent(kpis.irr, locale, 1) },
    { label: dict.performance.kpis.yield, value: formatPercent(kpis.cash_yield, locale, 1) },
    { label: dict.performance.kpis.drawdown, value: formatPercent(kpis.max_drawdown, locale, 1) },
    { label: dict.performance.kpis.deals, value: formatNumber(kpis.deals, locale) },
    { label: dict.performance.kpis.exits, value: formatNumber(kpis.exits, locale) },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-extrabold text-navy-900">{dict.admin.performance}</h1>
      <p className="mt-2 text-xs text-muted">
        {dict.common.updated}: {formatDate(kpis.as_of, locale)}
      </p>

      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="card p-5">
            <dt className="text-xs text-muted">{tile.label}</dt>
            <dd className="tnum mt-2 text-xl font-extrabold text-navy-900">{tile.value}</dd>
          </div>
        ))}
      </dl>

      <div className="card mt-8 p-6">
        <h2 className="text-base font-bold text-navy-900">{dict.performance.navTitle}</h2>
        <div className="mt-6">
          <NavTrendChart data={navSeries} locale={locale} valueLabel={dict.performance.navTitle} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-base font-bold text-navy-900">
            {dict.performance.allocationTitle}
          </h2>
          <div className="mt-6">
            <AllocationBar data={allocation} labels={dict.sectors} locale={locale} />
          </div>
        </div>
        <div className="card p-6">
          <h2 className="text-base font-bold text-navy-900">
            {dict.performance.annualTitle}
          </h2>
          <div className="mt-6">
            <ReturnsBarChart data={annual} locale={locale} label={dict.performance.annualTitle} />
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted">{dict.admin.readOnlyNote}</p>
    </div>
  );
}
