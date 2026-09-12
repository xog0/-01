"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { LocaleSwitch } from "./LocaleSwitch";
import { cn } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";

type NavLink = { key: string; href: string; label: string };

export function Header({
  locale,
  links,
  ctaLabel,
  adminLabel,
}: {
  locale: Locale;
  links: NavLink[];
  ctaLabel: string;
  adminLabel: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-colors",
        scrolled
          ? "border-line bg-paper/90 backdrop-blur-md"
          : "border-transparent bg-paper",
      )}
    >
      <div className="container-page flex h-[4.5rem] items-center justify-between gap-4">
        <Logo locale={locale} />

        <nav
          className="hidden items-center gap-0.5 xl:flex"
          aria-label={locale === "ar" ? "التنقل الرئيسي" : "Main navigation"}
        >
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.key}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-navy-900"
                    : "text-muted hover:bg-paper-2 hover:text-navy-900",
                )}
              >
                {link.label}
                {active && (
                  <span className="mx-auto mt-1 block h-0.5 w-5 rounded-full bg-gold-500" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5">
          <LocaleSwitch locale={locale} />
          <Link
            href={`/${locale}/contact`}
            className="btn btn-navy hidden !px-4 !py-2.5 text-sm md:inline-flex"
          >
            {ctaLabel}
          </Link>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={locale === "ar" ? "القائمة" : "Menu"}
            className="grid h-10 w-10 place-items-center rounded-lg border border-line text-navy-900 xl:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              {open ? (
                <path
                  d="M3 3l12 12M15 3L3 15"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M2 4.5h14M2 9h14M2 13.5h14"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div
          id="mobile-nav"
          className="border-t border-line bg-paper xl:hidden"
        >
          <nav className="container-page flex flex-col py-3">
            {links.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                onClick={() => setOpen(false)}
                className="border-b border-line/70 py-3.5 text-sm font-medium text-navy-900 last:border-0"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-4 flex flex-col gap-2 pb-4">
              <Link
                href={`/${locale}/contact`}
                onClick={() => setOpen(false)}
                className="btn btn-navy w-full"
              >
                {ctaLabel}
              </Link>
              <Link
                href={`/${locale}/admin`}
                onClick={() => setOpen(false)}
                className="btn btn-outline w-full !py-2.5 text-sm"
              >
                {adminLabel}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
