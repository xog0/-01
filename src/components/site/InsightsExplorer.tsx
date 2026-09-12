"use client";

import { useMemo, useState } from "react";
import { PostCard } from "./PostCard";
import { cn } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { Post, PostKind } from "@/types";

export function InsightsExplorer({
  posts,
  locale,
  dict,
}: {
  posts: Post[];
  locale: Locale;
  dict: Dictionary;
}) {
  const [kind, setKind] = useState<PostKind | "all">("all");

  const visible = useMemo(
    () => (kind === "all" ? posts : posts.filter((post) => post.kind === kind)),
    [posts, kind],
  );

  const options: { value: PostKind | "all"; label: string }[] = [
    { value: "all", label: dict.opportunities.filterAll },
    { value: "article", label: dict.insights.filterArticles },
    { value: "report", label: dict.insights.filterReports },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={dict.insights.title}>
        {options.map((option) => {
          const active = option.value === kind;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setKind(option.value)}
              aria-pressed={active}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm font-semibold transition-colors",
                active
                  ? "border-navy-900 bg-navy-900 text-white"
                  : "border-line bg-white text-muted hover:border-navy-200 hover:text-navy-900",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="mt-12 rounded-xl border border-line bg-white p-10 text-center text-sm text-muted">
          {dict.common.empty}
        </p>
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((post) => (
            <PostCard key={post.id} post={post} locale={locale} dict={dict} />
          ))}
        </div>
      )}
    </div>
  );
}
