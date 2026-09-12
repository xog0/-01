"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { isLocale, localeLabel, locales, type Locale } from "@/lib/i18n/config";
import { cn, persistLocale } from "@/lib/format";

/** يبدّل اللغة مع البقاء في نفس الصفحة، ويحفظ الاختيار في كوكي. */
export function LocaleSwitch({
  locale,
  variant = "dark",
}: {
  locale: Locale;
  variant?: "dark" | "light";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === locale) return;

    const segments = pathname.split("/").filter(Boolean);
    if (segments.length && isLocale(segments[0])) segments[0] = next;
    else segments.unshift(next);

    persistLocale(next);
    startTransition(() => {
      router.push(`/${segments.join("/")}`);
      router.refresh();
    });
  }

  const isLight = variant === "light";

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border p-0.5",
        isLight ? "border-white/20" : "border-line bg-paper-2/60",
        isPending && "opacity-60",
      )}
      role="group"
      aria-label={locale === "ar" ? "اللغة" : "Language"}
    >
      {locales.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            onClick={() => switchTo(code)}
            aria-current={active ? "true" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
              active
                ? isLight
                  ? "bg-white text-navy-900"
                  : "bg-navy-900 text-white"
                : isLight
                  ? "text-white/70 hover:text-white"
                  : "text-muted hover:text-navy-900",
            )}
          >
            {code === "ar" ? "ع" : "EN"}
            <span className="sr-only"> — {localeLabel[code]}</span>
          </button>
        );
      })}
    </div>
  );
}
