import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { WhatsAppFab } from "@/components/site/WhatsAppFab";
import { getDictionary } from "@/lib/i18n";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { navLinks } from "@/lib/nav";

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const dict = getDictionary(locale);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:start-3 focus:z-50 focus:rounded-lg focus:bg-navy-900 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        {dict.common.skipToContent}
      </a>

      <Header
        locale={locale}
        links={navLinks(locale, dict)}
        ctaLabel={dict.common.requestInvestment}
        adminLabel={dict.nav.admin}
      />

      <main id="main" className="flex-1">
        {children}
      </main>

      <Footer locale={locale} dict={dict} />
      <WhatsAppFab
        label={dict.common.whatsapp}
        message={dict.contact.whatsappPrefill}
      />
    </>
  );
}
