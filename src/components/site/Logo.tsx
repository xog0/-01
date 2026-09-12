import Link from "next/link";
import { siteConfig } from "@/lib/site.config";
import type { Locale } from "@/lib/i18n/config";

export function Logo({
  locale,
  variant = "dark",
}: {
  locale: Locale;
  variant?: "dark" | "light";
}) {
  const isLight = variant === "light";

  return (
    <Link
      href={`/${locale}`}
      className="inline-flex items-center gap-2.5"
      aria-label={siteConfig.name[locale]}
    >
      <svg
        width="34"
        height="34"
        viewBox="0 0 34 34"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect
          width="34"
          height="34"
          rx="9"
          fill={isLight ? "#C9A227" : "#0A1C33"}
        />
        {/* ثلاثة أعمدة ترمز لفئات الأصول الثلاث */}
        <rect x="9" y="19" width="3.6" height="7" rx="1.2" fill={isLight ? "#0A1C33" : "#C9A227"} />
        <rect x="15.2" y="14" width="3.6" height="12" rx="1.2" fill={isLight ? "#0A1C33" : "#D9B84A"} />
        <rect x="21.4" y="8" width="3.6" height="18" rx="1.2" fill={isLight ? "#0A1C33" : "#E8CE7E"} />
      </svg>
      <span className="flex flex-col leading-none">
        <span
          className={`text-[0.95rem] font-extrabold tracking-tight ${
            isLight ? "text-white" : "text-navy-900"
          }`}
        >
          {siteConfig.name[locale]}
        </span>
        <span
          className={`mt-1 text-[0.6875rem] font-medium ${
            isLight ? "text-navy-100/70" : "text-muted"
          }`}
        >
          {locale === "ar" ? "إدارة أصول" : "Asset Management"}
        </span>
      </span>
    </Link>
  );
}
