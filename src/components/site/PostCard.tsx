import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { Post } from "@/types";

const toneBg: Record<Post["tone"], string> = {
  navy: "from-navy-900 to-navy-700",
  gold: "from-gold-600 to-gold-400",
  teal: "from-[#0E8F80] to-[#2E6BB8]",
  plum: "from-[#A05FA8] to-[#2E6BB8]",
};

export function PostCard({
  post,
  locale,
  dict,
}: {
  post: Post;
  locale: Locale;
  dict: Dictionary;
}) {
  const title = locale === "ar" ? post.title_ar : post.title_en;
  const excerpt = locale === "ar" ? post.excerpt_ar : post.excerpt_en;

  return (
    <article className="card card-hover flex flex-col overflow-hidden">
      <div
        className={`relative h-28 bg-gradient-to-br ${toneBg[post.tone]}`}
        aria-hidden="true"
      >
        <span className="absolute bottom-3 start-4 badge bg-white/15 text-white backdrop-blur-sm">
          {post.kind === "report"
            ? dict.insights.filterReports
            : dict.insights.filterArticles}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <p className="text-xs text-muted">
          {formatDate(post.published_at, locale)} · {post.reading_minutes}{" "}
          {dict.insights.readingTime}
        </p>
        <h3 className="mt-2 text-base font-bold text-navy-900">
          <Link href={`/${locale}/insights/${post.slug}`} className="link-underline">
            {title}
          </Link>
        </h3>
        <p className="mt-2.5 line-clamp-3 flex-1 text-sm leading-relaxed text-muted">
          {excerpt}
        </p>
        <Link
          href={`/${locale}/insights/${post.slug}`}
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-600"
        >
          {dict.common.readMore}
          <span aria-hidden="true" className="rtl:rotate-180">
            →
          </span>
        </Link>
      </div>
    </article>
  );
}
