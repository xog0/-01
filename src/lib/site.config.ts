/**
 * الإعدادات العامة للموقع — عدّل هذا الملف وحده لتغيير الاسم وبيانات التواصل.
 * Central site settings — edit this file alone to change branding and contact details.
 */
export const siteConfig = {
  // اسم مؤقت — غيّره لاسم الصندوق الحقيقي
  name: { ar: "صندوق الرَّكيزة", en: "Rakiza Capital" },
  tagline: {
    ar: "محفظة استثمارية مُدارة في العقار والأسهم والمشاريع",
    en: "A managed portfolio across real estate, equities and ventures",
  },
  legalName: { ar: "شركة الركيزة للاستثمار", en: "Rakiza Investment Co." },
  currency: "USD",
  locale: { ar: "ar-SA-u-nu-latn", en: "en-US" },
  minimumTicket: 25_000,
  targetNetIrr: 14.5,
  aum: 186_400_000,
  inceptionYear: 2017,
  contact: {
    email: "invest@rakiza.example",
    phone: "+966 55 000 0000",
    // رقم واتساب بصيغة دولية بدون + وبدون مسافات
    whatsapp: "966550000000",
    address: {
      ar: "طريق الملك فهد، الرياض، المملكة العربية السعودية",
      en: "King Fahd Road, Riyadh, Saudi Arabia",
    },
  },
  social: {
    linkedin: "https://www.linkedin.com/",
    x: "https://x.com/",
  },
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://rakiza.example",
} as const;

export type SiteConfig = typeof siteConfig;
