import Link from "next/link";
import { DataTable } from "@/components/admin/DataTable";
import { getInvestmentRequests, getOpenOpportunities, getPosts } from "@/lib/data";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const dict = getDictionary(locale);

  const [requests, openDeals, posts] = await Promise.all([
    getInvestmentRequests(),
    getOpenOpportunities(),
    getPosts(),
  ]);

  const list = requests ?? [];
  const newCount = list.filter((item) => item.status === "new").length;
  const totalRequested = list.reduce((sum, item) => sum + (item.amount ?? 0), 0);

  const tiles = [
    { label: dict.admin.newRequests, value: formatNumber(newCount, locale) },
    {
      label: dict.admin.totalRequested,
      value: formatCurrency(totalRequested, locale, { compact: true }),
    },
    { label: dict.admin.openDeals, value: formatNumber(openDeals.length, locale) },
    { label: dict.admin.publishedPosts, value: formatNumber(posts.length, locale) },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-extrabold text-navy-900">{dict.admin.overview}</h1>

      {!isSupabaseConfigured && (
        <div className="mt-6 rounded-xl border border-gold-400/60 bg-gold-100/60 p-5">
          <p className="text-sm font-bold text-navy-900">
            {dict.admin.notConfiguredTitle}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-navy-800">
            {dict.admin.notConfiguredBody}
          </p>
        </div>
      )}

      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="card p-5">
            <dt className="text-xs text-muted">{tile.label}</dt>
            <dd className="tnum mt-2 text-2xl font-extrabold text-navy-900">
              {tile.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-10 flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-navy-900">{dict.admin.latestRequests}</h2>
        <Link
          href={`/${locale}/admin/requests`}
          className="text-sm font-semibold text-gold-600"
        >
          {dict.common.viewAll}
        </Link>
      </div>

      <div className="mt-4">
        <DataTable
          columns={[
            dict.admin.tableName,
            dict.admin.tableEmail,
            dict.admin.tableAmount,
            dict.admin.tableStatus,
            dict.admin.tableDate,
          ]}
          rows={list.slice(0, 6).map((item) => [
            <span key="n" className="font-semibold">{item.name}</span>,
            <span key="e" dir="ltr" className="text-muted">{item.email}</span>,
            <span key="a" className="tnum">
              {item.amount ? formatCurrency(item.amount, locale, { compact: true }) : "—"}
            </span>,
            <span key="s" className="badge bg-paper-2 text-muted">
              {dict.status[item.status]}
            </span>,
            <span key="d" className="text-muted">{formatDate(item.created_at, locale)}</span>,
          ])}
          empty={isSupabaseConfigured ? dict.common.empty : dict.admin.notConfiguredTitle}
        />
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted">
        {dict.admin.readOnlyNote}
      </p>
    </div>
  );
}
