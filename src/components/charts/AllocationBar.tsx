"use client";

import { useState } from "react";
import { sectorColor } from "@/lib/charts";
import { formatPercent } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { AllocationSlice } from "@/types";

/**
 * جزء-من-كل: شريط مكدّس أفقي بفواصل ٢ بكسل، مع قائمة معنونة مباشرة —
 * الهوية لا تعتمد على اللون وحده.
 */
export function AllocationBar({
  data,
  labels,
  locale,
}: {
  data: AllocationSlice[];
  labels: Record<string, string>;
  locale: Locale;
}) {
  const [active, setActive] = useState<string | null>(null);
  const total = data.reduce((sum, slice) => sum + slice.weight, 0) || 1;

  return (
    <div>
      <div className="flex h-12 w-full gap-0.5 overflow-hidden rounded-lg">
        {data.map((slice) => (
          <div
            key={slice.sector}
            role="img"
            aria-label={`${labels[slice.sector]}: ${formatPercent(slice.weight, locale, 0)}`}
            title={`${labels[slice.sector]} — ${formatPercent(slice.weight, locale, 0)}`}
            onMouseEnter={() => setActive(slice.sector)}
            onMouseLeave={() => setActive(null)}
            className="h-full transition-opacity duration-200"
            style={{
              width: `${(slice.weight / total) * 100}%`,
              backgroundColor: sectorColor[slice.sector],
              opacity: active && active !== slice.sector ? 0.45 : 1,
            }}
          />
        ))}
      </div>

      <ul className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {data.map((slice) => (
          <li
            key={slice.sector}
            onMouseEnter={() => setActive(slice.sector)}
            onMouseLeave={() => setActive(null)}
            className="flex items-center justify-between gap-3 border-b border-line pb-3"
          >
            <span className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: sectorColor[slice.sector] }}
              />
              <span className="text-sm font-medium text-navy-900">
                {labels[slice.sector]}
              </span>
            </span>
            <span className="tnum text-sm font-bold text-navy-900">
              {formatPercent(slice.weight, locale, 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
