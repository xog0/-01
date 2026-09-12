import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getTeam } from "@/lib/data";
import { getDictionary } from "@/lib/i18n";
import { defaultLocale, isLocale } from "@/lib/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const dict = getDictionary(locale);
  return { title: dict.about.title, description: dict.about.subtitle };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const dict = getDictionary(locale);
  const team = await getTeam();

  return (
    <>
      <PageHeader
        eyebrow={dict.nav.about}
        title={dict.about.title}
        subtitle={dict.about.subtitle}
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          <SectionHeading title={dict.about.storyTitle} />
          <div className="prose-ar">
            {dict.about.story.map((paragraph) => (
              <p key={paragraph.slice(0, 24)}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-paper-2/60">
        <div className="container-page">
          <SectionHeading title={dict.about.valuesTitle} align="center" />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {dict.about.values.map((value) => (
              <div key={value.title} className="card p-7">
                <span
                  aria-hidden="true"
                  className="block h-1 w-10 rounded-full bg-gold-500"
                />
                <h3 className="mt-5 text-lg font-bold text-navy-900">
                  {value.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {value.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-page">
          <SectionHeading
            eyebrow={dict.about.teamTitle}
            title={dict.about.teamSubtitle}
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((member) => (
              <article key={member.name_en} className="card p-6">
                <span
                  aria-hidden="true"
                  className="grid h-14 w-14 place-items-center rounded-full bg-navy-900 text-sm font-bold text-gold-400"
                >
                  {locale === "ar" ? member.initials : member.name_en.split(" ").map((w) => w[0]).join("")}
                </span>
                <h3 className="mt-5 text-base font-bold text-navy-900">
                  {locale === "ar" ? member.name_ar : member.name_en}
                </h3>
                <p className="mt-1 text-xs font-semibold text-gold-600">
                  {locale === "ar" ? member.role_ar : member.role_en}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {locale === "ar" ? member.bio_ar : member.bio_en}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page pb-20">
        <div className="card grid gap-8 p-8 md:grid-cols-[1fr_1.4fr] md:p-12">
          <h2 className="text-2xl font-extrabold text-navy-900">
            {dict.about.governanceTitle}
          </h2>
          <p className="text-base leading-relaxed text-muted">
            {dict.about.governanceBody}
          </p>
        </div>
      </section>
    </>
  );
}
