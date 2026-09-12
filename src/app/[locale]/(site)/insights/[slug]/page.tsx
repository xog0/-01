import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/site/PostCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getPostBySlug, getPosts } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { defaultLocale, isLocale, locales } from "@/lib/i18n/config";

export async function generateStaticParams() {
  const posts = await getPosts();
  return locales.flatMap((locale) =>
    posts.map((post) => ({ locale, slug: post.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const post = await getPostBySlug(slug);
  if (!post) return {};
  return {
    title: locale === "ar" ? post.title_ar : post.title_en,
    description: locale === "ar" ? post.excerpt_ar : post.excerpt_en,
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const dict = getDictionary(locale);

  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const all = await getPosts();
  const related = all.filter((other) => other.slug !== post.slug).slice(0, 3);

  const title = locale === "ar" ? post.title_ar : post.title_en;
  const body = locale === "ar" ? post.body_ar : post.body_en;
  const author = locale === "ar" ? post.author_ar : post.author_en;

  return (
    <>
      <section className="surface-navy">
        <div className="container-page py-14 md:py-18">
          <Link
            href={`/${locale}/insights`}
            className="inline-flex items-center gap-2 text-sm text-navy-100/60 transition-colors hover:text-gold-300"
          >
            <span aria-hidden="true" className="rtl:rotate-180">←</span>
            {dict.common.backTo} {dict.nav.insights}
          </Link>

          <span className="badge mt-6 bg-white/10 text-gold-300">
            {post.kind === "report"
              ? dict.insights.filterReports
              : dict.insights.filterArticles}
          </span>

          <h1 className="mt-5 max-w-3xl text-3xl font-extrabold text-white md:text-[2.5rem] md:leading-tight">
            {title}
          </h1>

          <p className="mt-5 text-sm text-navy-100/60">
            {dict.insights.byAuthor} {author} · {formatDate(post.published_at, locale)} ·{" "}
            {post.reading_minutes} {dict.insights.readingTime}
          </p>
        </div>
      </section>

      <article className="section">
        <div className="container-page max-w-3xl">
          <div className="prose-ar text-[1.0625rem]">
            {body.split("\n\n").map((paragraph) => (
              <p key={paragraph.slice(0, 24)}>{paragraph}</p>
            ))}
          </div>

          {post.file_url && (
            <a
              href={post.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-navy mt-10"
            >
              {dict.common.downloadReport}
            </a>
          )}
        </div>
      </article>

      {related.length > 0 && (
        <section className="section bg-paper-2/60">
          <div className="container-page">
            <SectionHeading title={dict.insights.title} />
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {related.map((other) => (
                <PostCard key={other.id} post={other} locale={locale} dict={dict} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
