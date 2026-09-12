import { DataTable } from "@/components/admin/DataTable";
import { getInvestmentRequests } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function AdminRequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const dict = getDictionary(locale);
  const list = (await getInvestmentRequests()) ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-extrabold text-navy-900">{dict.admin.requests}</h1>

      <div className="mt-8">
        <DataTable
          columns={[
            dict.admin.tableName,
            dict.admin.tableEmail,
            dict.contact.phone,
            dict.admin.tableAmount,
            dict.admin.tableInterest,
            dict.admin.tableStatus,
            dict.admin.tableDate,
          ]}
          rows={list.map((item) => [
            <span key="n" className="font-semibold">{item.name}</span>,
            <span key="e" dir="ltr" className="text-muted">{item.email}</span>,
            <span key="p" dir="ltr" className="tnum text-muted">{item.phone ?? "—"}</span>,
            <span key="a" className="tnum">
              {item.amount ? formatCurrency(item.amount, locale, { compact: true }) : "—"}
            </span>,
            <span key="i" className="text-muted">
              {item.interest ? dict.sectors[item.interest] : "—"}
            </span>,
            <span key="s" className="badge bg-paper-2 text-muted">
              {dict.status[item.status]}
            </span>,
            <span key="d" className="text-muted">{formatDate(item.created_at, locale)}</span>,
          ])}
          empty={isSupabaseConfigured ? dict.common.empty : dict.admin.notConfiguredTitle}
        />
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted">{dict.admin.readOnlyNote}</p>
    </div>
  );
}
