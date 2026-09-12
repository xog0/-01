"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

export function LoginForm(props: { locale: Locale; dict: Dictionary }) {
  return (
    <Suspense>
      <LoginFormInner {...props} />
    </Suspense>
  );
}

function LoginFormInner({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const data = new FormData(event.currentTarget);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError(dict.admin.notConfiguredTitle);
      setBusy(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
    });

    if (signInError) {
      setError(dict.admin.signInError);
      setBusy(false);
      return;
    }

    router.push(searchParams.get("next") ?? `/${locale}/admin`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className="block text-xs font-medium text-navy-100/70">
          {dict.admin.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          dir="ltr"
          className="mt-1.5 w-full rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white outline-none transition-colors focus:border-gold-400"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-xs font-medium text-navy-100/70">
          {dict.admin.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          dir="ltr"
          className="mt-1.5 w-full rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white outline-none transition-colors focus:border-gold-400"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-negative/15 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="btn btn-primary w-full disabled:opacity-60"
      >
        {busy ? dict.admin.signingIn : dict.admin.signIn}
      </button>
    </form>
  );
}
