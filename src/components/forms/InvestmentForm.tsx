"use client";

import { useState } from "react";
import { cn, whatsappLink } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { Sector } from "@/types";

type Status = "idle" | "sending" | "success" | "error";

const interests: Sector[] = ["real_estate", "equities", "ventures"];

export function InvestmentForm({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const payload = {
      name: String(data.get("name") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      phone: String(data.get("phone") ?? "").trim() || null,
      amount: data.get("amount") ? Number(data.get("amount")) : null,
      interest: (String(data.get("interest") ?? "") || null) as Sector | null,
      message: String(data.get("message") ?? "").trim(),
      locale,
    };

    const nextErrors: Record<string, string> = {};
    if (payload.name.length < 2) nextErrors.name = dict.contact.validation.name;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(payload.email)) {
      nextErrors.email = dict.contact.validation.email;
    }
    if (payload.message.length < 10) nextErrors.message = dict.contact.validation.message;

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setStatus("sending");
    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("request failed");
      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="card p-10 text-center">
        <span
          aria-hidden="true"
          className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-positive/10 text-2xl text-positive"
        >
          ✓
        </span>
        <h2 className="mt-6 text-xl font-extrabold text-navy-900">
          {dict.contact.successTitle}
        </h2>
        <p className="mt-3 text-sm text-muted">{dict.contact.successBody}</p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="btn btn-outline mt-7 !py-2.5 text-sm"
        >
          {dict.contact.formTitle}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card p-7 md:p-9">
      <h2 className="text-xl font-extrabold text-navy-900">
        {dict.contact.formTitle}
      </h2>

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <TextField
          name="name"
          label={dict.contact.name}
          required
          error={errors.name}
          autoComplete="name"
        />
        <TextField
          name="email"
          type="email"
          label={dict.contact.email}
          required
          error={errors.email}
          autoComplete="email"
          dir="ltr"
        />
        <TextField
          name="phone"
          type="tel"
          label={dict.contact.phone}
          autoComplete="tel"
          dir="ltr"
        />
        <TextField
          name="amount"
          type="number"
          label={dict.contact.amount}
          min={1000}
          step={1000}
          dir="ltr"
        />

        <div className="sm:col-span-2">
          <label htmlFor="interest" className="block text-sm font-medium text-navy-900">
            {dict.contact.interest}
          </label>
          <select
            id="interest"
            name="interest"
            defaultValue=""
            className="mt-2 w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-navy-900 outline-none transition-colors focus:border-gold-500"
          >
            <option value="">—</option>
            {interests.map((sector) => (
              <option key={sector} value={sector}>
                {dict.sectors[sector]}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="message" className="block text-sm font-medium text-navy-900">
            {dict.contact.message} <span className="text-negative">*</span>
          </label>
          <textarea
            id="message"
            name="message"
            rows={5}
            required
            placeholder={dict.contact.messagePlaceholder}
            aria-invalid={Boolean(errors.message)}
            className={cn(
              "mt-2 w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-navy-900 outline-none transition-colors focus:border-gold-500",
              errors.message ? "border-negative" : "border-line",
            )}
          />
          {errors.message && (
            <p className="mt-1.5 text-xs text-negative">{errors.message}</p>
          )}
        </div>
      </div>

      {status === "error" && (
        <div className="mt-6 rounded-lg border border-negative/30 bg-negative/5 p-4">
          <p className="text-sm font-semibold text-negative">
            {dict.contact.errorTitle}
          </p>
          <p className="mt-1 text-xs text-negative/80">{dict.contact.errorBody}</p>
        </div>
      )}

      <p className="mt-6 text-xs text-muted">{dict.contact.consent}</p>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={status === "sending"}
          className="btn btn-navy disabled:opacity-60"
        >
          {status === "sending" ? dict.contact.submitting : dict.contact.submit}
        </button>
        <a
          href={whatsappLink(dict.contact.whatsappPrefill)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline"
        >
          {dict.common.whatsapp}
        </a>
      </div>
    </form>
  );
}

function TextField({
  name,
  label,
  error,
  required,
  ...rest
}: {
  name: string;
  label: string;
  error?: string;
  required?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-navy-900">
        {label} {required && <span className="text-negative">*</span>}
      </label>
      <input
        id={name}
        name={name}
        required={required}
        aria-invalid={Boolean(error)}
        className={cn(
          "mt-2 w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-navy-900 outline-none transition-colors focus:border-gold-500",
          error ? "border-negative" : "border-line",
        )}
        {...rest}
      />
      {error && <p className="mt-1.5 text-xs text-negative">{error}</p>}
    </div>
  );
}
