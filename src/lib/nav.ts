import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

export const navItems = [
  { key: "about", path: "/about" },
  { key: "strategy", path: "/strategy" },
  { key: "performance", path: "/performance" },
  { key: "opportunities", path: "/opportunities" },
  { key: "insights", path: "/insights" },
  { key: "faq", path: "/faq" },
  { key: "contact", path: "/contact" },
] as const;

export type NavKey = (typeof navItems)[number]["key"];

export function href(locale: Locale, path: string) {
  return `/${locale}${path === "/" ? "" : path}`;
}

export function navLinks(locale: Locale, dict: Dictionary) {
  return navItems.map((item) => ({
    key: item.key,
    href: href(locale, item.path),
    label: dict.nav[item.key],
  }));
}
