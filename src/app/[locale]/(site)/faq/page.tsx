import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { getDictionary } from "@/lib/i18n";
import { defaultLocale, isLocale } from "@/lib/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const dict = getDictionary(locale);
  return { title: dict.faq.title, description: dict.faq.subtitle };
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const dict = getDictionary(locale);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: dict.faq.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <>
      <PageHeader
        eyebrow={dict.nav.faq}
        title={dict.faq.title}
        subtitle={dict.faq.subtitle}
      />

      <section className="section">
        <div className="container-page max-w-3xl">
          <div className="divide-y divide-line rounded-2xl border border-line bg-white">
            {dict.faq.items.map((item) => (
              <details key={item.q} className="group p-6 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-start justify-between gap-4 text-base font-bold text-navy-900">
                  {item.q}
                  <span
                    aria-hidden="true"
                    className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line text-muted transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-4 text-sm leading-relaxed text-muted">{item.a}</p>
              </details>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-line bg-paper-2/60 p-8 text-center">
            <p className="text-sm text-muted">{dict.contact.subtitle}</p>
            <Link href={`/${locale}/contact`} className="btn btn-navy mt-5">
              {dict.nav.contact}
            </Link>
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
