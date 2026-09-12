"use client";

import { useState } from "react";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

export function ReturnCalculator({
  locale,
  dict,
  defaultAmount,
  defaultYears,
  defaultRate,
}: {
  locale: Locale;
  dict: Dictionary;
  defaultAmount: number;
  defaultYears: number;
  defaultRate: number;
}) {
  const [amount, setAmount] = useState(defaultAmount);
  const [years, setYears] = useState(defaultYears);
  const [rate, setRate] = useState(defaultRate);

  const projected = amount * (1 + rate / 100) ** years;
  const profit = projected - amount;

  return (
    <div className="card p-7 md:p-9">
      <h2 className="text-xl font-extrabold text-navy-900">
        {dict.opportunities.calculatorTitle}
      </h2>
      <p className="mt-2 text-sm text-muted">
        {dict.opportunities.calculatorSubtitle}
      </p>

      <div className="mt-8 grid gap-7 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        <div className="space-y-6">
          <Field
            id="calc-amount"
            label={dict.opportunities.calcAmount}
            value={formatCurrency(amount, locale)}
          >
            <input
              id="calc-amount"
              type="range"
              min={10000}
              max={1000000}
              step={5000}
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value))}
              className="w-full accent-[#C9A227]"
            />
          </Field>

          <Field
            id="calc-years"
            label={dict.opportunities.calcYears}
            value={`${years} ${years > 2 ? dict.common.years : dict.common.year}`}
          >
            <input
              id="calc-years"
              type="range"
              min={1}
              max={15}
              step={1}
              value={years}
              onChange={(event) => setYears(Number(event.target.value))}
              className="w-full accent-[#C9A227]"
            />
          </Field>

          <Field
            id="calc-rate"
            label={dict.opportunities.calcRate}
            value={formatPercent(rate, locale, 1)}
          >
            <input
              id="calc-rate"
              type="range"
              min={2}
              max={30}
              step={0.5}
              value={rate}
              onChange={(event) => setRate(Number(event.target.value))}
              className="w-full accent-[#C9A227]"
            />
          </Field>
        </div>

        <div className="surface-navy rounded-xl p-7">
          <p className="text-xs font-semibold text-navy-100/60">
            {dict.opportunities.calcProjected}
          </p>
          <p className="tnum mt-2 text-3xl font-extrabold text-gold-300">
            {formatCurrency(projected, locale)}
          </p>

          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="text-xs font-semibold text-navy-100/60">
              {dict.opportunities.calcProfit}
            </p>
            <p className="tnum mt-1.5 text-xl font-bold text-white">
              + {formatCurrency(profit, locale)}
            </p>
          </div>

          <p className="mt-6 text-[0.7rem] leading-relaxed text-navy-100/50">
            {dict.opportunities.calcNote}
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  children,
}: {
  id: string;
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-muted">
          {label}
        </label>
        <output htmlFor={id} className="tnum text-sm font-bold text-navy-900">
          {value}
        </output>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
