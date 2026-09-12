export function PageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <section className="surface-navy">
      <div className="container-page py-16 md:py-20">
        {eyebrow && <p className="eyebrow !text-gold-400">{eyebrow}</p>}
        <h1 className="mt-3 max-w-3xl text-3xl font-extrabold text-white md:text-[2.75rem] md:leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-4 max-w-xl text-base leading-relaxed text-navy-100/70">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
