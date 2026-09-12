import Link from "next/link";
import { StatusBadge } from "@/components/ui/Badge";
import { formatCurrency, formatPercent } from "@/lib/format";
import { sectorColor } from "@/lib/charts";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { Opportunity } from "@/types";

export function OpportunityCard({
  item,
  locale,
  dict,
}: {
  item: Opportunity;
  locale: Locale;
  dict: Dictionary;
}) {
  const progress = Math.min(100, Math.round((item.raised / item.target_raise) * 100));
  const title = locale === "ar" ? item.title_ar : item.title_en;
  const summary = locale === "ar" ? item.summary_ar : item.summary_en;
  const location = locale === "ar" ? item.location_ar : item.location_en;

  return (
    <article className="card card-hover flex flex-col overflow-hidden">
      <div
        className="h-1.5 w-full"
        style={{ backgroundColor: sectorColor[item.sector] }}
        aria-hidden="true"
      />
      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={item.status} label={dict.status[item.status]} />
          <span className="badge bg-paper-2 text-muted">
            {dict.sectors[item.sector]}
          </span>
        </div>

        <h3 className="mt-4 text-lg font-bold text-navy-900">
          <Link
            href={`/${locale}/opportunities/${item.slug}`}
            className="link-underline"
          >
            {title}
          </Link>
        </h3>
        <p className="mt-0.5 text-xs text-muted">{location}</p>

        <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-muted">
          {summary}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-5">
          <div>
            <dt className="text-xs text-muted">{dict.opportunities.targetReturn}</dt>
            <dd className="tnum mt-1 text-base font-extrabold text-navy-900">
              {formatPercent(item.target_return, locale, 1)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{dict.opportunities.ticket}</dt>
            <dd className="tnum mt-1 text-base font-extrabold text-navy-900">
              {formatCurrency(item.min_ticket, locale, { compact: true })}
            </dd>
          </div>
        </dl>

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{dict.opportunities.raised}</span>
            <span className="tnum font-semibold text-navy-900">
              {formatCurrency(item.raised, locale, { compact: true })} {dict.opportunities.of}{" "}
              {formatCurrency(item.target_raise, locale, { compact: true })}
            </span>
          </div>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-paper-2"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={dict.opportunities.raised}
          >
            <div
              className="h-full rounded-full bg-gold-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
