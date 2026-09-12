import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { Logo } from "@/components/site/Logo";
import { getDictionary } from "@/lib/i18n";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const dict = getDictionary(locale);

  const items = [
    { href: `/${locale}/admin`, label: dict.admin.overview },
    { href: `/${locale}/admin/requests`, label: dict.admin.requests },
    { href: `/${locale}/admin/opportunities`, label: dict.admin.opportunities },
    { href: `/${locale}/admin/performance`, label: dict.admin.performance },
    { href: `/${locale}/admin/posts`, label: dict.admin.posts },
  ];

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <aside className="surface-navy lg:w-64 lg:shrink-0">
        <div className="flex h-full flex-col gap-6 p-5 lg:sticky lg:top-0 lg:h-screen">
          <Logo locale={locale} variant="light" />
          <p className="text-xs font-semibold text-gold-400">{dict.admin.title}</p>

          <div className="flex-1">
            <AdminNav items={items} />
          </div>

          <div className="space-y-2">
            <Link
              href={`/${locale}`}
              className="block rounded-lg px-3 py-2 text-xs text-white/60 transition-colors hover:text-gold-300"
            >
              ← {dict.nav.home}
            </Link>
            {isSupabaseConfigured && (
              <SignOutButton label={dict.admin.signOut} locale={locale} />
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 bg-paper px-5 py-8 md:px-8 md:py-10">{children}</main>
    </div>
  );
}
