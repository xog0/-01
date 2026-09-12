import Link from "next/link";
import { AllocationBar } from "@/components/charts/AllocationBar";
import { OpportunityCard } from "@/components/site/OpportunityCard";
import { PostCard } from "@/components/site/PostCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Stat } from "@/components/ui/Stat";
import { getAllocation, getKpis, getLatestPosts, getOpenOpportunities } from "@/lib/data";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { siteConfig } from "@/lib/site.config";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const dict = getDictionary(locale);

  const [kpis, allocation, opportunities, posts] = await Promise.all([
    getKpis(),
    getAllocation(),
    getOpenOpportunities(3),
    getLatestPosts(3),
  ]);

  const trackRecord = new Date().getFullYear() - siteConfig.inceptionYear;

  return (
    <>
      {/* البطل */}
      <section className="surface-navy relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div className="container-page relative py-20 md:py-28">
          <p className="eyebrow !text-gold-400">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
            {dict.home.eyebrow}
          </p>

          <h1 className="mt-5 max-w-3xl whitespace-pre-line text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-[3.25rem] md:leading-[1.15]">
            {dict.home.heroTitle}
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-navy-100/75 md:text-lg">
            {dict.home.heroSubtitle}
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link href={`/${locale}/contact`} className="btn btn-primary">
              {dict.home.heroPrimaryCta}
            </Link>
            <Link href={`/${locale}/performance`} className="btn btn-ghost-light">
              {dict.home.heroSecondaryCta}
            </Link>
          </div>

          <dl className="mt-16 grid grid-cols-2 gap-8 border-t border-white/10 pt-10 md:grid-cols-4">
            <Stat
              tone="light"
              label={dict.home.stats.aum}
              value={formatCurrency(kpis.nav, locale, { compact: true })}
            />
            <Stat
              tone="light"
              label={dict.home.stats.irr}
              value={formatPercent(siteConfig.targetNetIrr, locale, 1)}
            />
            <Stat
              tone="light"
              label={dict.home.stats.minimum}
              value={formatCurrency(siteConfig.minimumTicket, locale, { compact: true })}
            />
            <Stat
              tone="light"
              label={dict.home.stats.track}
              value={formatNumber(trackRecord, locale)}
            />
          </dl>
        </div>
      </section>

      {/* الركائز */}
      <section className="section">
        <div className="container-page">
          <SectionHeading
            eyebrow={dict.home.pillarsTitle}
            title={dict.home.pillarsSubtitle}
          />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {dict.home.pillars.map((pillar, index) => (
              <div key={pillar.title} className="card p-7">
                <span className="tnum grid h-10 w-10 place-items-center rounded-lg bg-navy-900 text-sm font-bold text-gold-400">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-5 text-lg font-bold text-navy-900">
                  {pillar.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {pillar.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* التوزيع */}
      <section className="section bg-paper-2/60">
        <div className="container-page grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow={dict.performance.title}
              title={dict.home.sectorsTitle}
              subtitle={dict.home.sectorsSubtitle}
            />
            <Link
              href={`/${locale}/performance`}
              className="btn btn-outline mt-8 !py-2.5 text-sm"
            >
              {dict.home.heroSecondaryCta}
            </Link>
          </div>
          <div className="card p-7">
            <AllocationBar
              data={allocation}
              labels={dict.sectors}
              locale={locale}
            />
          </div>
        </div>
      </section>

      {/* الفرص */}
      {opportunities.length > 0 && (
        <section className="section">
          <div className="container-page">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <SectionHeading
                eyebrow={dict.nav.opportunities}
                title={dict.home.opportunitiesTitle}
                subtitle={dict.home.opportunitiesSubtitle}
              />
              <Link
                href={`/${locale}/opportunities`}
                className="btn btn-outline !py-2.5 text-sm"
              >
                {dict.common.viewAll}
              </Link>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {opportunities.map((item) => (
                <OpportunityCard
                  key={item.id}
                  item={item}
                  locale={locale}
                  dict={dict}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* الخطوات */}
      <section className="section bg-paper-2/60">
        <div className="container-page">
          <SectionHeading
            eyebrow={dict.home.processTitle}
            title={dict.home.processSubtitle}
            align="center"
          />
          <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {dict.home.process.map((step, index) => (
              <li key={step.title} className="relative card p-6">
                <span className="tnum text-4xl font-extrabold text-gold-300">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-base font-bold text-navy-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* المدونة */}
      {posts.length > 0 && (
        <section className="section">
          <div className="container-page">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <SectionHeading
                eyebrow={dict.nav.insights}
                title={dict.home.insightsTitle}
                subtitle={dict.home.insightsSubtitle}
              />
              <Link
                href={`/${locale}/insights`}
                className="btn btn-outline !py-2.5 text-sm"
              >
                {dict.common.viewAll}
              </Link>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} locale={locale} dict={dict} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* نداء الإجراء */}
      <section className="container-page pb-20">
        <div className="surface-navy rounded-2xl px-8 py-14 text-center md:px-16">
          <h2 className="mx-auto max-w-xl text-2xl font-extrabold text-white md:text-3xl">
            {dict.home.ctaTitle}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-navy-100/70">
            {dict.home.ctaBody}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={`/${locale}/contact`} className="btn btn-primary">
              {dict.common.requestInvestment}
            </Link>
            <Link href={`/${locale}/strategy`} className="btn btn-ghost-light">
              {dict.nav.strategy}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
