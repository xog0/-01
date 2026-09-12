import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const sectors = new Set(["real_estate", "equities", "ventures", "cash"]);

/**
 * يستقبل طلب الاستثمار ويحفظه في Supabase عند توفّرها.
 * بدون قاعدة بيانات يُسجَّل الطلب في السجلّ ويُعاد stored:false —
 * المستخدم يرى رسالة النجاح ويبقى زر واتساب قناة بديلة.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim().slice(0, 120);
  const email = String(body.email ?? "").trim().slice(0, 160);
  const message = String(body.message ?? "").trim().slice(0, 4000);
  const phone = body.phone ? String(body.phone).trim().slice(0, 40) : null;
  const interestRaw = body.interest ? String(body.interest) : "";
  const interest = sectors.has(interestRaw) ? interestRaw : null;
  const amountRaw = Number(body.amount);
  const amount = Number.isFinite(amountRaw) && amountRaw > 0 ? Math.round(amountRaw) : null;
  const locale = body.locale === "en" ? "en" : "ar";

  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || message.length < 10) {
    return NextResponse.json({ error: "validation_failed" }, { status: 422 });
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    console.info("[investment-request]", { name, email, phone, amount, interest, locale });
    return NextResponse.json({ ok: true, stored: false });
  }

  const { error } = await supabase.from("investment_requests").insert({
    name,
    email,
    phone,
    amount,
    interest,
    message,
    locale,
    status: "new",
  });

  if (error) {
    console.error("[investment-request] insert failed", error.message);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, stored: true });
}
