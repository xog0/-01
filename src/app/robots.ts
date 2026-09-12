import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site.config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/ar/admin", "/en/admin"] }],
    sitemap: [`${siteConfig.url}/ar/sitemap.xml`, `${siteConfig.url}/en/sitemap.xml`],
  };
}
