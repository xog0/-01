/* =====================================================================
   ملف معلومات المطعم — عدّل القيم هنا فقط ولا تحتاج لمس بقية الملفات
   العلامات (( )) تعني: بيانات تحتاج تأكيدك
   ===================================================================== */
window.SITE_CONFIG = {
  brand: { ar: "٣ أسياخ", en: "3 Asyakh" },
  tagline: { ar: "شاورما ومشاوي على الفحم", en: "Charcoal Shawarma & Grills" },

  // (( أكّد الرقم )) — بصيغة دولية بدون + وبدون مسافات للواتساب
  phone: "+966560651635",
  whatsapp: "966560651635",
  email: "",

  // (( أكّد العنوان ورابط الخريطة ))
  address: {
    ar: "جدة — حي ميناء جدة الإسلامي",
    en: "Jeddah — Islamic Port District"
  },
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=%D9%A3+%D8%A3%D8%B3%D9%8A%D8%A7%D8%AE+%D8%AC%D8%AF%D8%A9",

  // (( أكّد أوقات الدوام ))
  hours: [
    { day: { ar: "السبت – الخميس", en: "Sat – Thu" }, time: { ar: "١٢:٠٠ ظهراً – ٢:٠٠ فجراً", en: "12:00 PM – 2:00 AM" } },
    { day: { ar: "الجمعة", en: "Friday" }, time: { ar: "١:٣٠ ظهراً – ٢:٠٠ فجراً", en: "1:30 PM – 2:00 AM" } }
  ],

  // (( ضع روابطك — احذف أي سطر لا تستخدمه ))
  social: {
    instagram: "",
    tiktok: "",
    snapchat: ""
  },

  // (( ضع رابط صفحتك في كل تطبيق — احذف ما لا ينطبق ))
  delivery: [
    { name: { ar: "هنقرستيشن", en: "HungerStation" }, url: "https://hungerstation.com/sa-ar/restaurants/regions/%D8%AC%D8%AF%D9%87/%D9%85%D9%8A%D9%86%D8%A7%D8%A1-%D8%AC%D8%AF%D8%A9-%D8%A7%D9%84%D8%A7%D8%B3%D9%84%D8%A7%D9%85%D9%8A/3-%D8%A7%D8%B3%D9%8A%D8%A7%D8%AE-163785" },
    { name: { ar: "جاهز", en: "Jahez" }, url: "" },
    { name: { ar: "كيتا", en: "Keeta" }, url: "" }
  ],

  currency: { ar: "ر.س", en: "SAR" },

  // أرقام قسم الواجهة — مأخوذة من المنيو نفسه
  stats: [
    { value: "١١ ر.س", valueEn: "SAR 11", label: { ar: "يبدأ السيخ من", en: "Skewers from" } },
    { value: "٤٠", valueEn: "40", label: { ar: "قطعة في بوكس الجمعات", en: "Pieces per party box" } },
    { value: "٤", valueEn: "4", label: { ar: "أقسام في المنيو", en: "Menu sections" } }
  ]
};
