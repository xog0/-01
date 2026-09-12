import type { MetadataRoute } from "next";
import { getOpportunities, getPosts } from "@/lib/data";
import { locales } from "@/lib/i18n/config";
import { navItems } from "@/lib/nav";
import { siteConfig } from "@/lib/site.config";

export async function generateSitemaps() {
  return locales.map((locale) => ({ id: locale }));
}

export default async function sitemap({
  id,
}: {
  id: string;
}): Promise<MetadataRoute.Sitemap> {
  const locale = locales.includes(id as (typeof locales)[number]) ? id : locales[0];
  const [opportunities, posts] = await Promise.all([getOpportunities(), getPosts()]);

  const staticPaths = ["", ...navItems.map((item) => item.path)];

  return [
    ...staticPaths.map((path) => ({
      url: `${siteConfig.url}/${locale}${path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    })),
    ...opportunities.map((item) => ({
      url: `${siteConfig.url}/${locale}/opportunities/${item.slug}`,
      lastModified: new Date(item.created_at),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...posts.map((post) => ({
      url: `${siteConfig.url}/${locale}/insights/${post.slug}`,
      lastModified: new Date(post.published_at),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
