import { cn } from "@/lib/format";

export function Stat({
  label,
  value,
  hint,
  tone = "dark",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "dark" | "light";
}) {
  return (
    <div>
      <p
        className={cn(
          "tnum text-2xl font-extrabold sm:text-[1.75rem]",
          tone === "light" ? "text-gold-300" : "text-navy-900",
        )}
      >
        {value}
      </p>
      <p
        className={cn(
          "mt-1.5 text-sm font-medium",
          tone === "light" ? "text-navy-100/70" : "text-muted",
        )}
      >
        {label}
      </p>
      {hint && (
        <p
          className={cn(
            "mt-0.5 text-xs",
            tone === "light" ? "text-navy-100/45" : "text-muted/70",
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
