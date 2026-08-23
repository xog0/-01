/* =====================================================================
   المنيو — لإضافة صنف جديد انسخ أي سطر { ... } وعدّله
   badge: "popular" | "spicy" | "new" | null
   img: ضع اسم الصورة داخل مجلد assets/img/ مثل "shawarma-1.jpg" أو اتركها null
   ===================================================================== */
window.MENU_DATA = [
  {
    id: "shawarma",
    name: { ar: "الشاورما", en: "Shawarma" },
    note: { ar: "لحم وفراخ متبّلة تدور على الفحم طوال اليوم", en: "Marinated meat & chicken, slow-turned all day" },
    items: [
      { name: { ar: "شاورما دجاج عربي", en: "Arabic Chicken Shawarma" }, desc: { ar: "خبز عربي، ثومية، مخلل، بطاطس", en: "Arabic bread, garlic sauce, pickles, fries" }, price: 12, badge: "popular", img: null },
      { name: { ar: "شاورما لحم عربي", en: "Arabic Meat Shawarma" }, desc: { ar: "خبز عربي، طحينة، بقدونس، بصل سماق", en: "Arabic bread, tahini, parsley, sumac onion" }, price: 15, badge: null, img: null },
      { name: { ar: "شاورما صاج مكس", en: "Mixed Saj Shawarma" }, desc: { ar: "لحم ودجاج مع جبنة موزاريلا وصوص خاص", en: "Meat & chicken with mozzarella and house sauce" }, price: 18, badge: "popular", img: null },
      { name: { ar: "شاورما نار", en: "Fire Shawarma" }, desc: { ar: "دجاج مع صوص حار على طريقتنا", en: "Chicken with our signature hot sauce" }, price: 14, badge: "spicy", img: null },
      { name: { ar: "صحن شاورما دجاج", en: "Chicken Shawarma Plate" }, desc: { ar: "شاورما مع رز أو بطاطس وسلطة وخبز", en: "Shawarma with rice or fries, salad and bread" }, price: 28, badge: null, img: null },
      { name: { ar: "صحن شاورما لحم", en: "Meat Shawarma Plate" }, desc: { ar: "شاورما لحم مع رز، طحينة وسلطة", en: "Meat shawarma with rice, tahini and salad" }, price: 34, badge: null, img: null }
    ]
  },
  {
    id: "tikka",
    name: { ar: "التكا والمشاوي", en: "Tikka & Grills" },
    note: { ar: "متبّلة ٢٤ ساعة ومشوية على فحم طبيعي", en: "Marinated 24h, grilled over natural charcoal" },
    items: [
      { name: { ar: "تكا دجاج", en: "Chicken Tikka" }, desc: { ar: "قطع صدور متبّلة بالزبادي والبهار الهندي", en: "Breast cubes marinated in yogurt & Indian spices" }, price: 32, badge: "popular", img: null },
      { name: { ar: "تكا حار", en: "Spicy Tikka" }, desc: { ar: "تتبيلة الفلفل الأحمر والليمون الأسود", en: "Red chili and black lime marinade" }, price: 34, badge: "spicy", img: null },
      { name: { ar: "تكا لحم غنم", en: "Lamb Tikka" }, desc: { ar: "قطع غنم طرية مع بصل وفلفل مشوي", en: "Tender lamb cubes with grilled onion & pepper" }, price: 45, badge: null, img: null },
      { name: { ar: "شيش طاووق", en: "Shish Tawook" }, desc: { ar: "دجاج بتتبيلة الليمون والثوم", en: "Chicken in lemon-garlic marinade" }, price: 30, badge: null, img: null },
      { name: { ar: "كباب مشوي", en: "Grilled Kebab" }, desc: { ar: "لحم مفروم مع بقدونس وبصل", en: "Minced meat with parsley and onion" }, price: 36, badge: null, img: null },
      { name: { ar: "مشاوي مشكلة (٢ شخص)", en: "Mixed Grill (serves 2)" }, desc: { ar: "تكا، كباب، طاووق، أجنحة مع رز وسلطات", en: "Tikka, kebab, tawook, wings with rice & salads" }, price: 89, badge: "popular", img: null }
    ]
  },
  {
    id: "appetizers",
    name: { ar: "المقبلات والسلطات", en: "Appetizers & Salads" },
    note: { ar: "تُحضّر طازجة يومياً", en: "Prepared fresh daily" },
    items: [
      { name: { ar: "حمص بالطحينة", en: "Hummus" }, desc: { ar: "حمص مخفوق مع زيت زيتون بكر", en: "Whipped chickpeas with virgin olive oil" }, price: 12, badge: null, img: null },
      { name: { ar: "متبل باذنجان", en: "Mutabbal" }, desc: { ar: "باذنجان مشوي على الفحم مع طحينة", en: "Charcoal-roasted eggplant with tahini" }, price: 13, badge: null, img: null },
      { name: { ar: "فتوش", en: "Fattoush" }, desc: { ar: "خضار طازجة مع خبز محمّص ودبس رمان", en: "Fresh greens, toasted bread, pomegranate molasses" }, price: 15, badge: null, img: null },
      { name: { ar: "بطاطس مقلية", en: "French Fries" }, desc: { ar: "مع صوص الثوم", en: "Served with garlic sauce" }, price: 10, badge: null, img: null },
      { name: { ar: "كبة مقلية (٤ حبات)", en: "Fried Kibbeh (4 pcs)" }, desc: { ar: "برغل محشي لحم وصنوبر", en: "Bulgur stuffed with meat and pine nuts" }, price: 18, badge: "new", img: null }
    ]
  },
  {
    id: "sandwiches",
    name: { ar: "وجبات وسندويشات", en: "Meals & Sandwiches" },
    note: { ar: "وجبات كاملة بأسعار مناسبة", en: "Complete value meals" },
    items: [
      { name: { ar: "وجبة شاورما + بطاطس + مشروب", en: "Shawarma Combo" }, desc: { ar: "سندويش شاورما مع بطاطس ومشروب غازي", en: "Shawarma sandwich with fries and a soft drink" }, price: 22, badge: "popular", img: null },
      { name: { ar: "بوكس عائلي", en: "Family Box" }, desc: { ar: "٦ سندويشات مع بطاطس كبير وصوصات", en: "6 sandwiches with large fries and dips" }, price: 79, badge: null, img: null },
      { name: { ar: "برجر تكا", en: "Tikka Burger" }, desc: { ar: "قطعة تكا مشوية داخل خبز البريوش", en: "Grilled tikka fillet in a brioche bun" }, price: 26, badge: "new", img: null }
    ]
  },
  {
    id: "drinks",
    name: { ar: "المشروبات والحلى", en: "Drinks & Desserts" },
    note: { ar: "لختام مناسب للوجبة", en: "A proper end to the meal" },
    items: [
      { name: { ar: "عصير ليمون نعناع", en: "Mint Lemonade" }, desc: { ar: "طازج ومحضّر عند الطلب", en: "Freshly made to order" }, price: 12, badge: "popular", img: null },
      { name: { ar: "لبن عيران", en: "Ayran" }, desc: { ar: "لبن مخفوق مثلج", en: "Chilled whipped yogurt drink" }, price: 7, badge: null, img: null },
      { name: { ar: "مشروبات غازية", en: "Soft Drinks" }, desc: { ar: "علبة ٣٣٠ مل", en: "330ml can" }, price: 5, badge: null, img: null },
      { name: { ar: "كنافة بالجبن", en: "Cheese Kunafa" }, desc: { ar: "تُحضّر عند الطلب مع القطر", en: "Made to order with syrup" }, price: 20, badge: null, img: null },
      { name: { ar: "أرز بحليب", en: "Rice Pudding" }, desc: { ar: "مبرّد مع فستق حلبي", en: "Chilled with pistachio" }, price: 14, badge: null, img: null }
    ]
  }
];

/* آراء العملاء — عدّل أو احذف */
window.TESTIMONIALS = [
  { text: { ar: "أفضل شاورما جربتها في المدينة، الطعم ثابت من أول يوم.", en: "The best shawarma in town — the taste never changes." }, author: { ar: "أحمد ا.", en: "Ahmed A." } },
  { text: { ar: "التكا مشوية على أصولها والخدمة سريعة جداً.", en: "The tikka is grilled properly and service is very fast." }, author: { ar: "سارة م.", en: "Sara M." } },
  { text: { ar: "طلبت بوكس عائلي وكان أكثر من ممتاز، أنصح فيه.", en: "Ordered the family box — outstanding. Highly recommend." }, author: { ar: "خالد ع.", en: "Khalid A." } }
];
