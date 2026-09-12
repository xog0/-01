import Link from "next/link";
import { getDictionary } from "@/lib/i18n";
import { defaultLocale } from "@/lib/i18n/config";

export default function NotFound() {
  // لا يمكن قراءة params داخل not-found، فنعرض اللغتين معاً.
  const ar = getDictionary("ar");
  const en = getDictionary(defaultLocale === "ar" ? "en" : "ar");

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="max-w-md text-center">
        <p className="text-6xl font-extrabold text-gold-500">404</p>
        <h1 className="mt-4 text-2xl font-extrabold text-navy-900">
          {ar.notFound.title}
        </h1>
        <p className="mt-2 text-muted">{ar.notFound.body}</p>
        <p className="mt-1 text-sm text-muted/80" dir="ltr">
          {en.notFound.body}
        </p>
        <Link href="/" className="btn btn-navy mt-7">
          {ar.notFound.cta}
        </Link>
      </div>
    </div>
  );
}
