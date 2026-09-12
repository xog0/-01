import type { Metadata } from "next";
import { InvestmentForm } from "@/components/forms/InvestmentForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { whatsappLink } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { siteConfig } from "@/lib/site.config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const dict = getDictionary(locale);
  return { title: dict.contact.title, description: dict.contact.subtitle };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const dict = getDictionary(locale);

  const rows = [
    { label: dict.contact.emailLabel, value: siteConfig.contact.email, href: `mailto:${siteConfig.contact.email}`, ltr: true },
    { label: dict.contact.phoneLabel, value: siteConfig.contact.phone, href: `tel:${siteConfig.contact.phone.replace(/\s/g, "")}`, ltr: true },
    { label: dict.contact.addressLabel, value: siteConfig.contact.address[locale], href: null, ltr: false },
    { label: dict.contact.hoursLabel, value: dict.contact.hours, href: null, ltr: false },
  ];

  return (
    <>
      <PageHeader
        eyebrow={dict.nav.contact}
        title={dict.contact.title}
        subtitle={dict.contact.subtitle}
      />

      <section className="section">
        <div className="container-page grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <InvestmentForm locale={locale} dict={dict} />

          <aside className="space-y-6">
            <div className="card p-7">
              <h2 className="text-base font-bold text-navy-900">
                {dict.contact.infoTitle}
              </h2>
              <dl className="mt-5 divide-y divide-line border-t border-line">
                {rows.map((row) => (
                  <div key={row.label} className="py-3.5">
                    <dt className="text-xs text-muted">{row.label}</dt>
                    <dd
                      className="mt-1 text-sm font-medium text-navy-900"
                      dir={row.ltr ? "ltr" : undefined}
                    >
                      {row.href ? (
                        <a href={row.href} className="link-underline">
                          {row.value}
                        </a>
                      ) : (
                        row.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <a
              href={whatsappLink(dict.contact.whatsappPrefill)}
              target="_blank"
              rel="noopener noreferrer"
              className="card card-hover flex items-center gap-4 p-6"
            >
              <span
                aria-hidden="true"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#25D366]/10"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#128C4B" aria-hidden="true">
                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Z" />
                </svg>
              </span>
              <span>
                <span className="block text-sm font-bold text-navy-900">
                  {dict.contact.orWhatsapp}
                </span>
                <span className="block text-xs text-muted">{dict.common.whatsapp}</span>
              </span>
            </a>
          </aside>
        </div>
      </section>
    </>
  );
}
