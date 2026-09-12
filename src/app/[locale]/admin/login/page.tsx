import { LoginForm } from "@/components/admin/LoginForm";
import { Logo } from "@/components/site/Logo";
import { getDictionary } from "@/lib/i18n";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function AdminLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const dict = getDictionary(locale);

  return (
    <div className="surface-navy flex min-h-full flex-1 items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Logo locale={locale} variant="light" />
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm">
          <h1 className="text-lg font-extrabold text-white">{dict.admin.title}</h1>

          {isSupabaseConfigured ? (
            <LoginForm locale={locale} dict={dict} />
          ) : (
            <div className="mt-5 rounded-lg border border-gold-400/40 bg-gold-400/10 p-4">
              <p className="text-sm font-semibold text-gold-300">
                {dict.admin.notConfiguredTitle}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-navy-100/70">
                {dict.admin.notConfiguredBody}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
