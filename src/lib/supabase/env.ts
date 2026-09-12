export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * الموقع يعمل كاملاً ببيانات تجريبية إذا لم تُضبط المتغيّرات.
 * The site runs fully on seed data when these are not configured.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
