import Link from "next/link";
import { DataTable } from "@/components/admin/DataTable";
import { getOpportunities } from "@/lib/data";
import { formatCurrency, formatPercent } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { defaultLocale, isLocale } from "@/lib/i18n/config";

export default async function AdminOpportunitiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const dict = getDictionary(locale);
  const items = await getOpportunities();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-extrabold text-navy-900">
        {dict.admin.opportunities}
      </h1>

      <div className="mt-8">
        <DataTable
          columns={[
            dict.admin.tableTitle,
            dict.admin.tableSector,
            dict.admin.tableStatus,
            dict.opportunities.targetReturn,
            dict.admin.tableRaised,
          ]}
          rows={items.map((item) => {
            const progress = Math.min(
              100,
              Math.round((item.raised / item.target_raise) * 100),
            );
            return [
              <Link
                key="t"
                href={`/${locale}/opportunities/${item.slug}`}
                className="font-semibold link-underline"
              >
                {locale === "ar" ? item.title_ar : item.title_en}
              </Link>,
              <span key="s" className="text-muted">{dict.sectors[item.sector]}</span>,
              <span key="st" className="badge bg-paper-2 text-muted">
                {dict.status[item.status]}
              </span>,
              <span key="r" className="tnum">
                {formatPercent(item.target_return, locale, 1)}
              </span>,
              <span key="p" className="tnum">
                {progress}% · {formatCurrency(item.raised, locale, { compact: true })}
              </span>,
            ];
          })}
          empty={dict.common.empty}
        />
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted">{dict.admin.readOnlyNote}</p>
    </div>
  );
}
