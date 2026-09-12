import Link from "next/link";
import { DataTable } from "@/components/admin/DataTable";
import { getPosts } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { defaultLocale, isLocale } from "@/lib/i18n/config";

export default async function AdminPostsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const dict = getDictionary(locale);
  const posts = await getPosts();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-extrabold text-navy-900">{dict.admin.posts}</h1>

      <div className="mt-8">
        <DataTable
          columns={[
            dict.admin.tableTitle,
            dict.admin.tableSector,
            dict.insights.byAuthor,
            dict.admin.tableDate,
          ]}
          rows={posts.map((post) => [
            <Link
              key="t"
              href={`/${locale}/insights/${post.slug}`}
              className="font-semibold link-underline"
            >
              {locale === "ar" ? post.title_ar : post.title_en}
            </Link>,
            <span key="k" className="badge bg-paper-2 text-muted">
              {post.kind === "report"
                ? dict.insights.filterReports
                : dict.insights.filterArticles}
            </span>,
            <span key="a" className="text-muted">
              {locale === "ar" ? post.author_ar : post.author_en}
            </span>,
            <span key="d" className="text-muted">
              {formatDate(post.published_at, locale)}
            </span>,
          ])}
          empty={dict.common.empty}
        />
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted">{dict.admin.readOnlyNote}</p>
    </div>
  );
}
