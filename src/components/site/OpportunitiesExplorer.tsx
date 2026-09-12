"use client";

import { useMemo, useState } from "react";
import { OpportunityCard } from "./OpportunityCard";
import { cn } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { Opportunity, Sector } from "@/types";

const filterableSectors: Sector[] = ["real_estate", "equities", "ventures"];

export function OpportunitiesExplorer({
  items,
  locale,
  dict,
}: {
  items: Opportunity[];
  locale: Locale;
  dict: Dictionary;
}) {
  const [sector, setSector] = useState<Sector | "all">("all");

  const visible = useMemo(
    () => (sector === "all" ? items : items.filter((item) => item.sector === sector)),
    [items, sector],
  );

  const options: { value: Sector | "all"; label: string }[] = [
    { value: "all", label: dict.opportunities.filterAll },
    ...filterableSectors.map((value) => ({ value, label: dict.sectors[value] })),
  ];

  return (
    <div>
      {/* المرشّحات في صف واحد فوق الشبكة */}
      <div className="flex flex-wrap gap-2" role="group" aria-label={dict.opportunities.title}>
        {options.map((option) => {
          const active = option.value === sector;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setSector(option.value)}
              aria-pressed={active}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm font-semibold transition-colors",
                active
                  ? "border-navy-900 bg-navy-900 text-white"
                  : "border-line bg-white text-muted hover:border-navy-200 hover:text-navy-900",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="mt-12 rounded-xl border border-line bg-white p-10 text-center text-sm text-muted">
          {dict.common.empty}
        </p>
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <OpportunityCard key={item.id} item={item} locale={locale} dict={dict} />
          ))}
        </div>
      )}
    </div>
  );
}
