/* =====================================================================
   المنيو — لإضافة صنف انسخ أي سطر { ... } وعدّله
   badge: "popular" | "spicy" | "new" | null
   img: اسم الصورة داخل assets/img/ مثل "shawarma.jpg" أو null
   (( )) بجانب السعر تعني أنه استُنتج من نطاق سعري ويحتاج تأكيدك
   ===================================================================== */
window.MENU_DATA = [
  {
    id: "skewers",
    name: { ar: "السيخ", en: "Skewers" },
    note: { ar: "سندويشات مشوية على الفحم وتُحضّر عند الطلب", en: "Charcoal-grilled sandwiches, made to order" },
    items: [
      { name: { ar: "سيخ شاورما دجاج", en: "Chicken Shawarma Skewer" }, desc: { ar: "شاورما دجاج في خبز طازج مع الصوص", en: "Chicken shawarma in fresh bread with sauce" }, price: 11, badge: "popular", img: null },
      { name: { ar: "سيخ شاورما لحم", en: "Meat Shawarma Skewer" }, desc: { ar: "شاورما لحم في خبز طازج مع الصوص", en: "Meat shawarma in fresh bread with sauce" }, price: 12, badge: "popular", img: null },
      { name: { ar: "سيخ كباب دجاج", en: "Chicken Kebab Skewer" }, desc: { ar: "كباب دجاج مشوي على الفحم", en: "Charcoal-grilled chicken kebab" }, price: 12, badge: null, img: null },
      { name: { ar: "سيخ كباب لحم", en: "Meat Kebab Skewer" }, desc: { ar: "كباب لحم مشوي على الفحم", en: "Charcoal-grilled meat kebab" }, price: 12, badge: null, img: null },
      { name: { ar: "سيخ شيش طاووق", en: "Shish Tawook Skewer" }, desc: { ar: "دجاج متبّل ومشوي على الفحم", en: "Marinated chicken, charcoal-grilled" }, price: 13, badge: null, img: null },
      { name: { ar: "سيخ كنافة", en: "Kunafa Skewer" }, desc: { ar: "كنافة محمّصة تُحضّر عند الطلب", en: "Toasted kunafa, made to order" }, price: 20, badge: "new", img: null }
    ]
  },
  {
    id: "meals",
    name: { ar: "الوجبات والأطباق", en: "Meals & Plates" },
    note: { ar: "وجبات كاملة تكفي شخصاً", en: "Complete single-serve meals" },
    items: [
      { name: { ar: "وجبة عربي دجاج", en: "Arabic Chicken Meal" }, desc: { ar: "خبز عربي مع الصوصات والمخلل", en: "Arabic bread with sauces and pickles" }, price: 29, badge: null, img: null },
      { name: { ar: "وجبة عربي مكس", en: "Arabic Mixed Meal" }, desc: { ar: "دجاج ولحم في خبز عربي", en: "Chicken and meat in Arabic bread" }, price: 31, badge: null, img: null },
      { name: { ar: "وجبة عربي لحم", en: "Arabic Meat Meal" }, desc: { ar: "لحم مشوي في خبز عربي", en: "Grilled meat in Arabic bread" }, price: 33, badge: null, img: null },
      { name: { ar: "وجبة أرز دجاج", en: "Chicken Rice Meal" }, desc: { ar: "أرز مع دجاج مشوي وصوص", en: "Rice with grilled chicken and sauce" }, price: 27, badge: null, img: null },
      { name: { ar: "وجبة أرز مكس", en: "Mixed Rice Meal" }, desc: { ar: "أرز مع دجاج ولحم", en: "Rice with chicken and meat" }, price: 30, badge: null, img: null },
      { name: { ar: "وجبة أرز لحم", en: "Meat Rice Meal" }, desc: { ar: "أرز مع لحم مشوي وصوص", en: "Rice with grilled meat and sauce" }, price: 33, badge: null, img: null },
      { name: { ar: "صحن مشويات", en: "Mixed Grill Plate" }, desc: { ar: "تشكيلة مشاوي على الفحم", en: "An assortment of charcoal grills" }, price: 35, badge: "popular", img: null }
    ]
  },
  {
    id: "boxes",
    name: { ar: "بوكسات الجمعات", en: "Party Boxes" },
    note: { ar: "٤٠ قطعة — تكفي العزائم والتجمعات", en: "40 pieces — made for gatherings" },
    items: [
      { name: { ar: "بوكس دجاج (٤٠ قطعة)", en: "Chicken Box (40 pcs)" }, desc: { ar: "٤٠ قطعة دجاج مشوية مع الصوصات", en: "40 grilled chicken pieces with sauces" }, price: 80, badge: null, img: null },
      { name: { ar: "بوكس مكس (٤٠ قطعة)", en: "Mixed Box (40 pcs)" }, desc: { ar: "دجاج ولحم مع الصوصات", en: "Chicken and meat with sauces" }, price: 88, badge: "popular", img: null },
      { name: { ar: "بوكس لحم (٤٠ قطعة)", en: "Meat Box (40 pcs)" }, desc: { ar: "٤٠ قطعة لحم مشوية مع الصوصات", en: "40 grilled meat pieces with sauces" }, price: 95, badge: null, img: null }
    ]
  },
  {
    id: "sides",
    name: { ar: "المقبلات والصوصات", en: "Sides & Sauces" },
    note: { ar: "إضافات تكمل الوجبة", en: "The finishing touches" },
    items: [
      { name: { ar: "حمص", en: "Hummus" }, desc: { ar: "حمص بالطحينة وزيت الزيتون", en: "Chickpeas with tahini and olive oil" }, price: 8.5, badge: null, img: null },
      { name: { ar: "بطاطس", en: "Fries" }, desc: { ar: "بطاطس مقلية مع الصوص", en: "Fries served with sauce" }, price: 15.5, badge: null, img: null },
      { name: { ar: "صوصات إضافية", en: "Extra Sauces" }, desc: { ar: "ثومية، حار، طحينة", en: "Garlic, hot, tahini" }, price: "2 – 2.5", badge: null, img: null }
    ]
  }
];

/* آراء العملاء — فارغة عمداً: لا نضع تقييمات غير حقيقية.
   أرسل تقييمات حقيقية من خرائط جوجل وضعها هنا فيظهر القسم تلقائياً:
   { text: { ar: "نص التقييم", en: "Review text" }, author: { ar: "الاسم", en: "Name" } }
*/
window.TESTIMONIALS = [];
