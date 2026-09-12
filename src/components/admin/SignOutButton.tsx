"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOutButton({ label, locale }: { label: string; locale: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    await supabase?.auth.signOut();
    router.push(`/${locale}/admin/login`);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="w-full rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:border-gold-400 hover:text-gold-300 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
