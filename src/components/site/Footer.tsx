import Link from "next/link";
import { Logo } from "./Logo";
import { siteConfig } from "@/lib/site.config";
import { navLinks } from "@/lib/nav";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

export function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const links = navLinks(locale, dict);
  const year = new Date().getFullYear();

  return (
    <footer className="surface-navy mt-auto">
      <div className="container-page py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo locale={locale} variant="light" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-navy-100/70">
              {dict.footer.about}
            </p>
            <div className="mt-6 flex gap-3">
              <a
                href={siteConfig.social.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 text-white/80 transition-colors hover:border-gold-400 hover:text-gold-300"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.5 4.78 5.76V21h-4v-5.6c0-1.34-.03-3.07-1.9-3.07-1.9 0-2.2 1.46-2.2 2.97V21h-4V9Z" />
                </svg>
              </a>
              <a
                href={siteConfig.social.x}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X"
                className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 text-white/80 transition-colors hover:border-gold-400 hover:text-gold-300"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.9 2H22l-7.1 8.1L23.2 22h-6.5l-5.1-6.6L5.8 22H2.7l7.6-8.7L1.9 2h6.7l4.6 6.1L18.9 2Zm-1.1 18h1.7L7.3 3.7H5.5L17.8 20Z" />
                </svg>
              </a>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold text-white">{dict.footer.quickLinks}</h2>
            <ul className="mt-4 space-y-2.5">
              {links.map((link) => (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    className="text-sm text-navy-100/70 transition-colors hover:text-gold-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-bold text-white">{dict.contact.infoTitle}</h2>
            <ul className="mt-4 space-y-3 text-sm text-navy-100/70">
              <li>
                <a
                  href={`mailto:${siteConfig.contact.email}`}
                  className="transition-colors hover:text-gold-300"
                >
                  {siteConfig.contact.email}
                </a>
              </li>
              <li dir="ltr" className="tnum">
                <a
                  href={`tel:${siteConfig.contact.phone.replace(/\s/g, "")}`}
                  className="transition-colors hover:text-gold-300"
                >
                  {siteConfig.contact.phone}
                </a>
              </li>
              <li>{siteConfig.contact.address[locale]}</li>
              <li className="pt-1">
                <Link
                  href={`/${locale}/admin`}
                  className="text-xs text-navy-100/50 transition-colors hover:text-gold-300"
                >
                  {dict.nav.admin}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs leading-relaxed text-navy-100/60">
            {dict.footer.riskNotice}
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-navy-100/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {siteConfig.legalName[locale]}. {dict.footer.rights}
          </p>
          <div className="flex gap-5">
            <span>{dict.footer.terms}</span>
            <span>{dict.footer.privacy}</span>
            <span>{dict.footer.disclosure}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
