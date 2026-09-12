import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AllocationSlice,
  AnnualReturn,
  InvestmentRequest,
  NavPoint,
  Opportunity,
  PortfolioKpis,
  Post,
  TeamMember,
} from "@/types";
import {
  seedAllocation,
  seedAnnualReturns,
  seedKpis,
  seedNavSeries,
  seedOpportunities,
  seedPosts,
  seedTeam,
} from "./seed";

/**
 * كل دالة هنا تحاول القراءة من Supabase أولاً، وتسقط على البيانات التجريبية
 * إذا لم تكن مضبوطة أو كان الجدول فارغاً — فالموقع يعمل قبل الربط وبعده.
 *
 * Each reader tries Supabase first and falls back to seed data when it is not
 * configured or the table is still empty, so the site works before and after wiring.
 */

type SupabaseServerClient = NonNullable<
  Awaited<ReturnType<typeof createSupabaseServerClient>>
>;

async function query<T>(
  run: (client: SupabaseServerClient) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[] | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  try {
    const { data, error } = await run(supabase);
    if (error || !Array.isArray(data) || data.length === 0) return null;
    return data as T[];
  } catch {
    return null;
  }
}

export async function getOpportunities(): Promise<Opportunity[]> {
  const rows = await query<Opportunity>((db) =>
    db.from("opportunities").select("*").eq("published", true).order("created_at", { ascending: false }),
  );
  return rows ?? seedOpportunities;
}

export async function getOpenOpportunities(limit?: number): Promise<Opportunity[]> {
  const all = await getOpportunities();
  const open = all.filter((item) => item.status === "open" || item.status === "funding");
  return typeof limit === "number" ? open.slice(0, limit) : open;
}

export async function getOpportunityBySlug(slug: string): Promise<Opportunity | null> {
  const all = await getOpportunities();
  return all.find((item) => item.slug === slug) ?? null;
}

export async function getPosts(): Promise<Post[]> {
  const rows = await query<Post>((db) =>
    db.from("posts").select("*").eq("published", true).order("published_at", { ascending: false }),
  );
  return rows ?? seedPosts;
}

export async function getLatestPosts(limit: number): Promise<Post[]> {
  return (await getPosts()).slice(0, limit);
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const all = await getPosts();
  return all.find((item) => item.slug === slug) ?? null;
}

export async function getNavSeries(): Promise<NavPoint[]> {
  const rows = await query<NavPoint>((db) =>
    db.from("nav_series").select("period, value").order("period", { ascending: true }),
  );
  return rows ?? seedNavSeries;
}

export async function getAllocation(): Promise<AllocationSlice[]> {
  const rows = await query<AllocationSlice>((db) =>
    db.from("allocation").select("sector, weight").order("weight", { ascending: false }),
  );
  return rows ?? seedAllocation;
}

export async function getAnnualReturns(): Promise<AnnualReturn[]> {
  const rows = await query<AnnualReturn>((db) =>
    db.from("annual_returns").select("year, net_return").order("year", { ascending: true }),
  );
  return rows ?? seedAnnualReturns;
}

export async function getKpis(): Promise<PortfolioKpis> {
  const rows = await query<PortfolioKpis>((db) =>
    db.from("portfolio_kpis").select("*").order("as_of", { ascending: false }).limit(1),
  );
  return rows?.[0] ?? seedKpis;
}

export async function getTeam(): Promise<TeamMember[]> {
  const rows = await query<TeamMember>((db) =>
    db.from("team_members").select("*").order("sort_order", { ascending: true }),
  );
  return rows ?? seedTeam;
}

/** طلبات الاستثمار — للوحة الإدارة فقط، ولا تُعرض علناً. */
export async function getInvestmentRequests(): Promise<InvestmentRequest[] | null> {
  return query<InvestmentRequest>((db) =>
    db.from("investment_requests").select("*").order("created_at", { ascending: false }).limit(100),
  );
}
