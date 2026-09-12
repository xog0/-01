import type { Metadata } from "next";
import Link from "next/link";
import { AllocationBar } from "@/components/charts/AllocationBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getAllocation } from "@/lib/data";
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
  return { title: dict.strategy.title, description: dict.strategy.subtitle };
}

export default async function StrategyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const dict = getDictionary(locale);
  const allocation = await getAllocation();

  return (
    <>
      <PageHeader
        eyebrow={dict.nav.strategy}
        title={dict.strategy.title}
        subtitle={dict.strategy.subtitle}
      />

      <section className="section">
        <div className="container-page grid items-start gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              title={dict.strategy.allocationTitle}
              subtitle={dict.strategy.allocationBody}
            />
          </div>
          <div className="card p-7">
            <AllocationBar data={allocation} labels={dict.sectors} locale={locale} />
          </div>
        </div>
      </section>

      <section className="section bg-paper-2/60">
        <div className="container-page">
          <SectionHeading title={dict.strategy.criteriaTitle} align="center" />
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {dict.strategy.criteria.map((item, index) => (
              <div key={item.title} className="card flex gap-5 p-7">
                <span className="tnum grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold-100 text-sm font-bold text-gold-600">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-base font-bold text-navy-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-2">
          <div className="card p-8">
            <h2 className="text-xl font-extrabold text-navy-900">
              {dict.strategy.horizonTitle}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              {dict.strategy.horizonBody}
            </p>
          </div>

          <div className="card p-8">
            <h2 className="text-xl font-extrabold text-navy-900">
              {dict.strategy.feesTitle}
            </h2>
            <p className="mt-3 text-sm text-muted">{dict.strategy.feesBody}</p>
            <dl className="mt-6 divide-y divide-line border-t border-line">
              {dict.strategy.fees.map((fee) => (
                <div
                  key={fee.label}
                  className="flex flex-wrap items-center justify-between gap-2 py-3.5"
                >
                  <dt className="text-sm text-muted">{fee.label}</dt>
                  <dd className="text-sm font-bold text-navy-900">{fee.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="container-page pb-20">
        <div className="rounded-2xl border border-gold-400/50 bg-gold-100/50 p-8 md:p-10">
          <h2 className="text-xl font-extrabold text-navy-900">
            {dict.strategy.riskTitle}
          </h2>
          <ul className="mt-5 space-y-3">
            {dict.strategy.risks.map((risk) => (
              <li key={risk.slice(0, 20)} className="flex gap-3 text-sm leading-relaxed text-navy-800">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-600" />
                {risk}
              </li>
            ))}
          </ul>
          <Link href={`/${locale}/contact`} className="btn btn-navy mt-8">
            {dict.common.requestInvestment}
          </Link>
        </div>
      </section>
    </>
  );
}
