/* =====================================================================
   ملف معلومات المطعم — عدّل القيم هنا فقط ولا تحتاج لمس بقية الملفات
   ===================================================================== */
window.SITE_CONFIG = {
  // اسم المطعم بالعربي والإنجليزي
  brand: { ar: "مطعم الذواقة", en: "Al Thawaqa" },
  tagline: { ar: "شاورما وتكا على أصولها", en: "Authentic Shawarma & Tikka" },

  // أرقام التواصل — ضع رقم الواتساب بصيغة دولية بدون + وبدون مسافات
  phone: "+966500000000",
  whatsapp: "966500000000",
  email: "info@example.com",

  // العنوان ورابط الموقع على خرائط جوجل
  address: {
    ar: "شارع الملك عبدالعزيز، حي النهضة، الرياض",
    en: "King Abdulaziz St., Al Nahda, Riyadh"
  },
  mapsUrl: "https://maps.google.com/?q=24.7136,46.6753",

  // أوقات الدوام (اتركها كما هي أو عدّلها)
  hours: [
    { day: { ar: "السبت – الخميس", en: "Sat – Thu" }, time: { ar: "١٢:٠٠ ظهراً – ٢:٠٠ فجراً", en: "12:00 PM – 2:00 AM" } },
    { day: { ar: "الجمعة", en: "Friday" }, time: { ar: "١:٣٠ ظهراً – ٢:٠٠ فجراً", en: "1:30 PM – 2:00 AM" } }
  ],

  // حسابات التواصل الاجتماعي — احذف أي سطر لا تستخدمه
  social: {
    instagram: "https://instagram.com/",
    tiktok: "https://tiktok.com/",
    snapchat: "https://snapchat.com/",
    x: "https://x.com/"
  },

  // تطبيقات التوصيل — احذف ما لا ينطبق
  delivery: [
    { name: { ar: "هنقرستيشن", en: "HungerStation" }, url: "#" },
    { name: { ar: "جاهز", en: "Jahez" }, url: "#" },
    { name: { ar: "كيتا", en: "Keeta" }, url: "#" }
  ],

  currency: { ar: "ر.س", en: "SAR" },

  // أرقام تظهر في قسم "لماذا نحن"
  stats: [
    { value: "١٥+", valueEn: "15+", label: { ar: "سنة خبرة", en: "Years of Experience" } },
    { value: "٤٠+", valueEn: "40+", label: { ar: "صنف في المنيو", en: "Menu Items" } },
    { value: "٩٨٪", valueEn: "98%", label: { ar: "رضا العملاء", en: "Customer Satisfaction" } }
  ]
};
