import { siteConfig } from "./site.config";
import type { Locale } from "./i18n/config";

/** ينسّق المبالغ بعملة الصندوق — formats amounts in the fund currency. */
export function formatCurrency(
  value: number,
  locale: Locale,
  options: { compact?: boolean; decimals?: number } = {},
) {
  const { compact = false, decimals = 0 } = options;
  return new Intl.NumberFormat(siteConfig.locale[locale], {
    style: "currency",
    currency: siteConfig.currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : decimals,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number, locale: Locale, decimals = 0) {
  return new Intl.NumberFormat(siteConfig.locale[locale], {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number, locale: Locale, decimals = 1) {
  return new Intl.NumberFormat(siteConfig.locale[locale], {
    style: "percent",
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value / 100);
}

export function formatDate(value: string, locale: Locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(siteConfig.locale[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** يختار الحقل العربي أو الإنجليزي من صف ثنائي اللغة. */
export function pick<T extends Record<string, unknown>, K extends string>(
  row: T,
  field: K,
  locale: Locale,
): T[`${K}_ar` & keyof T] {
  return row[`${field}_${locale}` as keyof T] as T[`${K}_ar` & keyof T];
}

export function whatsappLink(message: string) {
  return `https://wa.me/${siteConfig.contact.whatsapp}?text=${encodeURIComponent(message)}`;
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/** يحفظ تفضيل اللغة سنة كاملة ليقرأه proxy.ts عند أول زيارة. */
export function persistLocale(locale: string) {
  if (typeof document === "undefined") return;
  document.cookie = `locale=${locale}; path=/; max-age=31536000; samesite=lax`;
}
