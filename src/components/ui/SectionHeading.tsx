import { cn } from "@/lib/format";

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "start",
  tone = "dark",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "start" | "center";
  tone?: "dark" | "light";
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
      )}
    >
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2
        className={cn(
          "mt-3 text-2xl font-extrabold sm:text-3xl md:text-[2.1rem]",
          tone === "light" ? "text-white" : "text-navy-900",
        )}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={cn(
            "mt-3 text-base leading-relaxed",
            tone === "light" ? "text-navy-100/70" : "text-muted",
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
