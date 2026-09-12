import type {
  AllocationSlice,
  AnnualReturn,
  NavPoint,
  Opportunity,
  PortfolioKpis,
  Post,
  TeamMember,
} from "@/types";

/**
 * بيانات تجريبية تُستخدم عندما لا تكون Supabase مربوطة، أو عندما تكون الجداول فارغة.
 * Seed data used when Supabase is not connected, or its tables are still empty.
 */

export const seedOpportunities: Opportunity[] = [
  {
    id: "seed-1",
    slug: "riyadh-logistics-park",
    title_ar: "مجمّع الرياض اللوجستي",
    title_en: "Riyadh Logistics Park",
    summary_ar:
      "أربعة مستودعات بمساحة 38,000 م² شمال الرياض، مؤجرة بالكامل لثلاثة مشغّلين بعقود تمتد سبع سنوات.",
    summary_en:
      "Four warehouses totalling 38,000 m² north of Riyadh, fully leased to three operators on seven-year contracts.",
    body_ar:
      "الأصل مبنيّ على أرض مملوكة ملكية حرة على مسافة أحد عشر كيلومتراً من الطريق الدائري الشمالي، ويخدم ثلاثة مشغّلي خدمات لوجستية يعملون في التجارة الإلكترونية وتوزيع الأغذية.\n\nنسبة الإشغال 100% منذ التسليم في 2022، ومتوسط المدة المتبقية من العقود 4.6 سنوات، مع زيادة إيجارية تعاقدية 3% سنوياً. الدين على الأصل 49% من قيمته السوقية بسعر ثابت حتى 2029.\n\nمسار التخارج الأول هو البيع لصندوق عقاري مدرج عند اكتمال السنة الخامسة، والثاني هو إعادة التمويل والاحتفاظ بالأصل كمصدر دخل طويل.",
    body_en:
      "The asset sits on freehold land eleven kilometres from the northern ring road and serves three logistics operators working in e-commerce and food distribution.\n\nOccupancy has been 100% since handover in 2022, with a weighted average lease term of 4.6 years and contractual 3% annual rent escalation. Debt stands at 49% of market value, fixed until 2029.\n\nThe primary exit is a sale to a listed REIT at the end of year five; the secondary is refinancing and holding the asset as long-term income.",
    sector: "real_estate",
    status: "open",
    risk: "low",
    location_ar: "الرياض، السعودية",
    location_en: "Riyadh, Saudi Arabia",
    target_return: 11.4,
    min_ticket: 25000,
    horizon_years: 5,
    target_raise: 18000000,
    raised: 12600000,
    highlights_ar: [
      "إشغال 100% منذ 2022 دون أي فترة شغور",
      "زيادة إيجارية تعاقدية 3% سنوياً",
      "توزيعات نقدية ربعية تبدأ من الربع الأول بعد الإقفال",
      "رافعة مالية 49% بسعر فائدة ثابت حتى 2029",
    ],
    highlights_en: [
      "100% occupancy since 2022 with no vacancy periods",
      "Contractual 3% annual rent escalation",
      "Quarterly cash distributions from the first quarter after closing",
      "49% leverage at a fixed rate until 2029",
    ],
    financials: [
      {
        label_ar: "قيمة الأصل",
        label_en: "Asset value",
        value_ar: "36.5 مليون دولار",
        value_en: "$36.5M",
      },
      {
        label_ar: "صافي دخل التشغيل",
        label_en: "Net operating income",
        value_ar: "3.1 مليون دولار سنوياً",
        value_en: "$3.1M per year",
      },
      {
        label_ar: "معدل الرسملة",
        label_en: "Cap rate",
        value_ar: "8.5%",
        value_en: "8.5%",
      },
      {
        label_ar: "توزيع نقدي متوقع",
        label_en: "Expected cash yield",
        value_ar: "7.2% سنوياً",
        value_en: "7.2% per year",
      },
    ],
    tone: "navy",
    published: true,
    created_at: "2026-05-18T09:00:00Z",
  },
  {
    id: "seed-2",
    slug: "gulf-dividend-sleeve",
    title_ar: "محفظة توزيعات الخليج",
    title_en: "Gulf Dividend Sleeve",
    summary_ar:
      "محفظة مركّزة في 18 شركة مدرجة في السعودية والإمارات وقطر، مختارة على أساس استدامة التوزيعات لا نموّ السعر.",
    summary_en:
      "A concentrated book of 18 listed companies in Saudi Arabia, the UAE and Qatar, selected for dividend durability rather than price momentum.",
    body_ar:
      "نبني المحفظة حول شركات تحقق تدفقاً نقدياً حراً يغطي التوزيعات مرة ونصف على الأقل، وبنسبة دين إلى حقوق ملكية أقل من واحد.\n\nنستبعد القطاعات التي يصعب التنبؤ بأرباحها، ونحتفظ بنسبة سيولة لا تقل عن 8% للاستفادة من التصحيحات الحادة. لا نستخدم أي رافعة مالية في هذه المحفظة.\n\nإعادة التوازن ربعية، ومتوسط دوران المحفظة أقل من 30% سنوياً، مما يخفض تكلفة التداول ويُبقي التركيز على الجودة طويلة الأجل.",
    body_en:
      "We build around companies whose free cash flow covers the dividend at least 1.5 times, with a debt-to-equity ratio below one.\n\nWe exclude sectors whose earnings are hard to forecast and keep a minimum 8% cash position to take advantage of sharp corrections. No leverage is used in this book.\n\nRebalancing is quarterly and average turnover stays below 30% a year, which keeps trading costs low and the focus on long-term quality.",
    sector: "equities",
    status: "open",
    risk: "moderate",
    location_ar: "أسواق مجلس التعاون",
    location_en: "GCC markets",
    target_return: 9.8,
    min_ticket: 25000,
    horizon_years: 3,
    target_raise: 9000000,
    raised: 5850000,
    highlights_ar: [
      "18 شركة فقط — تركيز مدروس بدل التشتّت",
      "تغطية التوزيعات 1.5 مرة كحد أدنى",
      "صفر رافعة مالية",
      "سيولة يومية كاملة",
    ],
    highlights_en: [
      "Only 18 holdings — deliberate concentration over dilution",
      "Minimum 1.5x dividend cover",
      "Zero leverage",
      "Full daily liquidity",
    ],
    financials: [
      {
        label_ar: "عائد التوزيعات",
        label_en: "Dividend yield",
        value_ar: "5.4%",
        value_en: "5.4%",
      },
      {
        label_ar: "مكرر الربحية المرجّح",
        label_en: "Weighted P/E",
        value_ar: "13.2×",
        value_en: "13.2x",
      },
      {
        label_ar: "دوران المحفظة",
        label_en: "Turnover",
        value_ar: "28% سنوياً",
        value_en: "28% per year",
      },
      {
        label_ar: "نسبة السيولة",
        label_en: "Cash position",
        value_ar: "8% – 12%",
        value_en: "8% – 12%",
      },
    ],
    tone: "teal",
    published: true,
    created_at: "2026-04-02T09:00:00Z",
  },
  {
    id: "seed-3",
    slug: "jeddah-residential-block",
    title_ar: "مجمّع جدة السكني",
    title_en: "Jeddah Residential Block",
    summary_ar:
      "64 وحدة سكنية في حي الروضة بجدة، تُشترى مكتملة البناء وتُدار كوحدات إيجار سنوي.",
    summary_en:
      "64 residential units in Al Rawdah, Jeddah, acquired complete and operated as annual rentals.",
    body_ar:
      "الصفقة شراء أصل جاهز بخصم 14% عن التقييم المستقل، نتيجة حاجة البائع لتسييل سريع.\n\nخطة التشغيل تقوم على رفع الإشغال من 78% إلى 93% خلال ثمانية عشر شهراً عبر تجديد الوحدات الشاغرة وربط الإدارة بمشغّل متخصص.\n\nالتخارج المستهدف بيع المجمّع كاملاً بعد أربع سنوات عند وصول الإشغال إلى مستواه المستقر.",
    body_en:
      "The deal is the purchase of a completed asset at a 14% discount to independent valuation, driven by the seller's need for a fast exit.\n\nThe operating plan raises occupancy from 78% to 93% within eighteen months by refurbishing vacant units and handing management to a specialist operator.\n\nThe target exit is a whole-block sale after four years, once occupancy has stabilised.",
    sector: "real_estate",
    status: "funding",
    risk: "moderate",
    location_ar: "جدة، السعودية",
    location_en: "Jeddah, Saudi Arabia",
    target_return: 13.2,
    min_ticket: 50000,
    horizon_years: 4,
    target_raise: 11500000,
    raised: 3100000,
    highlights_ar: [
      "خصم شراء 14% عن التقييم المستقل",
      "خطة رفع إشغال من 78% إلى 93%",
      "مشغّل متخصص بعقد أداء",
      "موقع داخل نطاق طلب سكني مرتفع",
    ],
    highlights_en: [
      "14% acquisition discount to independent valuation",
      "Occupancy plan from 78% to 93%",
      "Specialist operator on a performance contract",
      "Located inside a high residential-demand catchment",
    ],
    financials: [
      {
        label_ar: "سعر الشراء",
        label_en: "Purchase price",
        value_ar: "22.8 مليون دولار",
        value_en: "$22.8M",
      },
      {
        label_ar: "الإشغال الحالي",
        label_en: "Current occupancy",
        value_ar: "78%",
        value_en: "78%",
      },
      {
        label_ar: "الإشغال المستهدف",
        label_en: "Target occupancy",
        value_ar: "93%",
        value_en: "93%",
      },
      {
        label_ar: "مضاعف رأس المال المستهدف",
        label_en: "Target equity multiple",
        value_ar: "1.65×",
        value_en: "1.65x",
      },
    ],
    tone: "gold",
    published: true,
    created_at: "2026-06-11T09:00:00Z",
  },
  {
    id: "seed-4",
    slug: "saas-growth-stake",
    title_ar: "حصة نمو في شركة برمجيات",
    title_en: "SaaS Growth Stake",
    summary_ar:
      "حصة أقلية 12% في شركة برمجيات إدارة أساطيل، إيراداتها المتكررة السنوية 6.2 مليون دولار وتنمو 48%.",
    summary_en:
      "A 12% minority stake in a fleet-management software company with $6.2M annual recurring revenue growing at 48%.",
    body_ar:
      "الشركة تخدم 310 عملاء من شركات النقل والتوزيع في أربعة أسواق، ومعدل بقاء الإيراد الصافي 124%، أي أن العملاء الحاليين ينفقون أكثر كل سنة.\n\nالجولة مخصصة لتوسيع فريق المبيعات في سوقين جديدين ولإكمال منتج التتبّع التنبّئي. الشركة قريبة من التعادل التشغيلي وتستطيع تأجيل الجولة التالية.\n\nهذه أعلى فئات المحفظة مخاطرة، ولا نخصص لها أكثر من 15% من رأس المال الكلي.",
    body_en:
      "The company serves 310 transport and distribution customers across four markets, with 124% net revenue retention — existing customers spend more each year.\n\nThe round funds sales expansion into two new markets and completion of a predictive-tracking product. The company is close to operating breakeven and can defer its next round.\n\nThis is the highest-risk part of the portfolio, and we cap it at 15% of total capital.",
    sector: "ventures",
    status: "open",
    risk: "high",
    location_ar: "دبي، الإمارات",
    location_en: "Dubai, UAE",
    target_return: 24,
    min_ticket: 100000,
    horizon_years: 6,
    target_raise: 6000000,
    raised: 4350000,
    highlights_ar: [
      "إيراد متكرر سنوي 6.2 مليون دولار ينمو 48%",
      "بقاء إيراد صافي 124%",
      "310 عملاء في أربعة أسواق",
      "مقعد في مجلس الإدارة وحقوق حماية أقلية",
    ],
    highlights_en: [
      "$6.2M ARR growing 48%",
      "124% net revenue retention",
      "310 customers across four markets",
      "Board seat and minority protection rights",
    ],
    financials: [
      {
        label_ar: "الإيراد المتكرر السنوي",
        label_en: "ARR",
        value_ar: "6.2 مليون دولار",
        value_en: "$6.2M",
      },
      {
        label_ar: "هامش الربح الإجمالي",
        label_en: "Gross margin",
        value_ar: "79%",
        value_en: "79%",
      },
      {
        label_ar: "تقييم ما قبل الجولة",
        label_en: "Pre-money valuation",
        value_ar: "44 مليون دولار",
        value_en: "$44M",
      },
      {
        label_ar: "مدة السيولة المتبقية",
        label_en: "Runway",
        value_ar: "22 شهراً",
        value_en: "22 months",
      },
    ],
    tone: "plum",
    published: true,
    created_at: "2026-03-21T09:00:00Z",
  },
  {
    id: "seed-5",
    slug: "dammam-cold-storage",
    title_ar: "مستودعات الدمام المبرّدة",
    title_en: "Dammam Cold Storage",
    summary_ar:
      "منشأة تخزين مبرّد سعتها 14,000 منصة، مؤجّرة لمشغّل أغذية بعقد عشر سنوات. تم التخارج في 2025.",
    summary_en:
      "A 14,000-pallet cold storage facility leased to a food operator on a ten-year contract. Exited in 2025.",
    body_ar:
      "دخلنا الأصل في 2020 بتكلفة 14.2 مليون دولار، وخرجنا منه في الربع الثاني 2025 عند 23.6 مليون دولار.\n\nمصدر العائد الأساسي لم يكن ارتفاع السوق، بل تثبيت عقد إيجار طويل مع مشغّل من الدرجة الأولى، وهو ما رفع التقييم عبر خفض معدل الرسملة المطبّق على الأصل.\n\nمضاعف رأس المال المحقق 1.83× وعائد داخلي 16.1% خلال خمس سنوات.",
    body_en:
      "We entered in 2020 at a cost of $14.2M and exited in Q2 2025 at $23.6M.\n\nThe return did not come from market appreciation but from locking in a long lease with a first-tier operator, which lifted valuation by compressing the cap rate applied to the asset.\n\nRealised equity multiple was 1.83x with a 16.1% IRR over five years.",
    sector: "real_estate",
    status: "exited",
    risk: "low",
    location_ar: "الدمام، السعودية",
    location_en: "Dammam, Saudi Arabia",
    target_return: 16.1,
    min_ticket: 25000,
    horizon_years: 5,
    target_raise: 14200000,
    raised: 14200000,
    highlights_ar: [
      "مضاعف رأس مال محقق 1.83×",
      "عائد داخلي 16.1%",
      "عقد إيجار عشر سنوات مع مشغّل من الدرجة الأولى",
      "تخارج كامل في الربع الثاني 2025",
    ],
    highlights_en: [
      "1.83x realised equity multiple",
      "16.1% IRR",
      "Ten-year lease with a first-tier operator",
      "Full exit in Q2 2025",
    ],
    financials: [
      {
        label_ar: "تكلفة الدخول",
        label_en: "Entry cost",
        value_ar: "14.2 مليون دولار",
        value_en: "$14.2M",
      },
      {
        label_ar: "قيمة التخارج",
        label_en: "Exit value",
        value_ar: "23.6 مليون دولار",
        value_en: "$23.6M",
      },
      {
        label_ar: "مدة الاحتفاظ",
        label_en: "Holding period",
        value_ar: "5 سنوات",
        value_en: "5 years",
      },
      {
        label_ar: "العائد الداخلي المحقق",
        label_en: "Realised IRR",
        value_ar: "16.1%",
        value_en: "16.1%",
      },
    ],
    tone: "navy",
    published: true,
    created_at: "2025-06-30T09:00:00Z",
  },
  {
    id: "seed-6",
    slug: "clinic-network-rollup",
    title_ar: "دمج شبكة عيادات",
    title_en: "Clinic Network Roll-up",
    summary_ar:
      "استحواذ على أربع عيادات أسنان مستقلة ودمجها تحت إدارة واحدة وعلامة تجارية موحّدة.",
    summary_en:
      "Acquiring four independent dental clinics and consolidating them under one management team and brand.",
    body_ar:
      "أطروحة الصفقة بسيطة: العيادة المستقلة تُقيَّم عند 4× الأرباح، والشبكة المدمجة ذات الإدارة المهنية تُقيَّم عند 8×.\n\nالقيمة تُخلق من ثلاثة مصادر: شراء موحّد للمستلزمات، نظام حجز ومحاسبة مشترك، وتحويل المرضى بين الفروع حسب التخصص.\n\nأُقفل الاكتتاب في هذه الصفقة، والأصل الآن في السنة الثانية من خطة الدمج.",
    body_en:
      "The thesis is simple: a standalone clinic trades at 4x earnings, while a professionally managed network trades at 8x.\n\nValue comes from three sources: consolidated supplies purchasing, a shared booking and accounting system, and referring patients between branches by specialty.\n\nSubscription for this deal is closed; the asset is now in year two of the consolidation plan.",
    sector: "ventures",
    status: "closed",
    risk: "moderate",
    location_ar: "الرياض والخبر",
    location_en: "Riyadh & Khobar",
    target_return: 19.5,
    min_ticket: 50000,
    horizon_years: 5,
    target_raise: 8400000,
    raised: 8400000,
    highlights_ar: [
      "فجوة تقييم من 4× إلى 8× الأرباح",
      "أربعة فروع قائمة ومربحة قبل الاستحواذ",
      "وفورات شراء موحّد 18% من تكلفة المستلزمات",
      "الاكتتاب مغلق — السنة الثانية من الخطة",
    ],
    highlights_en: [
      "Valuation gap from 4x to 8x earnings",
      "Four operating, profitable branches pre-acquisition",
      "18% supplies saving from consolidated purchasing",
      "Subscription closed — year two of the plan",
    ],
    financials: [
      {
        label_ar: "الأرباح المجمّعة",
        label_en: "Combined EBITDA",
        value_ar: "2.1 مليون دولار",
        value_en: "$2.1M",
      },
      {
        label_ar: "مضاعف الدخول",
        label_en: "Entry multiple",
        value_ar: "4.3×",
        value_en: "4.3x",
      },
      {
        label_ar: "مضاعف التخارج المستهدف",
        label_en: "Target exit multiple",
        value_ar: "7.5×",
        value_en: "7.5x",
      },
      {
        label_ar: "عدد الفروع",
        label_en: "Branches",
        value_ar: "4 فروع",
        value_en: "4 branches",
      },
    ],
    tone: "teal",
    published: true,
    created_at: "2025-11-14T09:00:00Z",
  },
];

export const seedPosts: Post[] = [
  {
    id: "post-1",
    slug: "q2-2026-report",
    kind: "report",
    title_ar: "التقرير الربعي — الربع الثاني 2026",
    title_en: "Quarterly report — Q2 2026",
    excerpt_ar:
      "أداء المحفظة، التحركات، والتوزيعات المعتمدة للربع الثاني، مع ملاحظات لجنة الاستثمار على صفقتين مرفوضتين.",
    excerpt_en:
      "Portfolio performance, moves and approved distributions for the second quarter, with committee notes on two rejected deals.",
    body_ar:
      "ارتفع صافي قيمة الأصول 3.2% خلال الربع، مدفوعاً بإعادة تقييم المجمّع اللوجستي في الرياض بعد تجديد عقدين من أصل ثلاثة.\n\nعلى الجانب الآخر، تراجعت محفظة الأسهم 1.1% نتيجة ضعف قطاع المواد الأساسية. لم نغيّر أي مركز بسبب هذا التراجع، لأن أطروحة الاستثمار في الشركات المعنية لم تتغيّر.\n\nاعتمدت اللجنة توزيعاً نقدياً بواقع 1.8% من صافي قيمة الأصول، ورفضت صفقتين: مشروع فندقي في منطقة موسمية، وحصة في شركة تقنية لم نستطع التحقق من أرقام احتفاظها بالعملاء.",
    body_en:
      "Net asset value rose 3.2% over the quarter, driven by a revaluation of the Riyadh logistics park after two of three leases were renewed.\n\nThe equities book fell 1.1% on weakness in basic materials. We changed no position because of that move, since the investment thesis on the affected companies has not changed.\n\nThe committee approved a cash distribution of 1.8% of NAV and rejected two deals: a hotel project in a seasonal market, and a stake in a technology company whose retention figures we could not verify.",
    author_ar: "لجنة الاستثمار",
    author_en: "Investment Committee",
    reading_minutes: 6,
    file_url: null,
    tone: "navy",
    published: true,
    published_at: "2026-07-14T08:00:00Z",
  },
  {
    id: "post-2",
    slug: "why-cap-rate-matters",
    kind: "article",
    title_ar: "معدل الرسملة: الرقم الذي يحدد قيمة عقارك",
    title_en: "Cap rate: the number that prices your property",
    excerpt_ar:
      "لماذا يستطيع عقاران بنفس الإيجار أن يختلفا في القيمة بمقدار الثلث؟ الجواب في رقم واحد يتجاهله كثيرون.",
    excerpt_en:
      "Why can two properties with identical rent differ in value by a third? The answer sits in one number most people skip.",
    body_ar:
      "معدل الرسملة هو صافي دخل التشغيل مقسوماً على قيمة الأصل. إذا كان الأصل يولّد مليون دولار صافياً ويُقيَّم بعشرة ملايين، فمعدل الرسملة 10%.\n\nالمهم أن العلاقة عكسية: كلما انخفض معدل الرسملة، ارتفعت القيمة. وانخفاضه يعني أن السوق يرى الدخل أكثر أماناً — عقد أطول، مستأجر أقوى، موقع أفضل.\n\nهنا تكمن الفرصة الحقيقية. يمكنك رفع قيمة أصل دون رفع إيجاره دولاراً واحداً، بمجرد تحويل مستأجر ضعيف بعقد سنة إلى مستأجر قوي بعقد عشر سنوات. هذا بالضبط ما فعلناه في مستودعات الدمام، وكان مصدر ثلثي العائد في تلك الصفقة.",
    body_en:
      "The cap rate is net operating income divided by asset value. If an asset nets $1M and is valued at $10M, the cap rate is 10%.\n\nWhat matters is that the relationship is inverse: the lower the cap rate, the higher the value. A lower rate means the market considers the income safer — longer lease, stronger tenant, better location.\n\nThat is where the real opportunity lives. You can raise an asset's value without raising rent by a single dollar, simply by replacing a weak one-year tenant with a strong ten-year one. That is exactly what we did at the Dammam cold store, and it produced two thirds of the return on that deal.",
    author_ar: "فريق العقار",
    author_en: "Real Estate Team",
    reading_minutes: 5,
    file_url: null,
    tone: "gold",
    published: true,
    published_at: "2026-06-02T08:00:00Z",
  },
  {
    id: "post-3",
    slug: "diversification-is-not-dilution",
    kind: "article",
    title_ar: "التنويع ليس تشتيتاً",
    title_en: "Diversification is not dilution",
    excerpt_ar:
      "امتلاك ستين سهماً لا يعني أنك منوّع. التنويع الحقيقي يقاس بالارتباط بين الأصول، لا بعددها.",
    excerpt_en:
      "Owning sixty stocks does not make you diversified. Real diversification is measured by correlation, not count.",
    body_ar:
      "المستثمر الذي يملك ستين شركة كلها في قطاع واحد وسوق واحدة ليس منوّعاً. إذا انخفض القطاع، انخفض كل ما يملك في اليوم نفسه.\n\nالمقياس الصحيح هو الارتباط: إلى أي حد تتحرك أصولك في الاتجاه نفسه؟ العقار المؤجّر بعقود طويلة لا يتأثر بجلسة تداول سيئة، والشركة الناشئة لا يحرّكها معدل الفائدة بنفس سرعة السهم المدرج.\n\nلهذا نبني المحفظة على ثلاث فئات لا تستجيب لنفس المحفّزات. الهدف ليس أن نربح في كل حالة، بل ألا نخسر في كل الحالات دفعة واحدة.",
    body_en:
      "An investor holding sixty companies in one sector and one market is not diversified. When the sector falls, everything they own falls on the same day.\n\nThe right measure is correlation: how far do your assets move together? Real estate on long leases does not care about a bad trading session, and a private company does not reprice on an interest-rate move as fast as a listed share.\n\nThat is why we build across three classes that do not respond to the same triggers. The goal is not to win in every state of the world — it is to avoid losing in all of them at once.",
    author_ar: "مكتب الاستثمار",
    author_en: "Investment Office",
    reading_minutes: 4,
    file_url: null,
    tone: "teal",
    published: true,
    published_at: "2026-04-28T08:00:00Z",
  },
  {
    id: "post-4",
    slug: "q1-2026-report",
    kind: "report",
    title_ar: "التقرير الربعي — الربع الأول 2026",
    title_en: "Quarterly report — Q1 2026",
    excerpt_ar:
      "بداية سنة هادئة: نمو 2.1% في صافي قيمة الأصول، وإغلاق صفقة واحدة، ورفع نسبة السيولة تحسّباً لفرص عقارية.",
    excerpt_en:
      "A quiet start: 2.1% NAV growth, one deal closed, and a higher cash position held back for real-estate opportunities.",
    body_ar:
      "الربع الأول كان هادئاً بشكل متعمّد. رفعنا نسبة السيولة من 6% إلى 9%، لا لأننا نتوقع هبوطاً، بل لأن ثلاث صفقات عقارية في مرحلة الفحص النافي للجهالة قد تُقفل خلال ستة أشهر.\n\nأُغلقت صفقة دمج شبكة العيادات بالكامل، وبدأ الفريق التشغيلي في توحيد أنظمة الحجز بين الفروع الأربعة.\n\nلم نجرِ أي تغيير على بنية الرسوم أو سياسة التوزيع.",
    body_en:
      "The first quarter was deliberately quiet. We raised cash from 6% to 9% — not because we expect a drawdown, but because three real-estate deals in diligence could close within six months.\n\nThe clinic roll-up closed in full, and the operating team began unifying booking systems across the four branches.\n\nNo changes were made to the fee structure or distribution policy.",
    author_ar: "لجنة الاستثمار",
    author_en: "Investment Committee",
    reading_minutes: 5,
    file_url: null,
    tone: "navy",
    published: true,
    published_at: "2026-04-11T08:00:00Z",
  },
  {
    id: "post-5",
    slug: "how-we-say-no",
    kind: "article",
    title_ar: "كيف نقول «لا» لصفقة",
    title_en: "How we say no to a deal",
    excerpt_ar:
      "رفضنا 31 صفقة العام الماضي وقبلنا أربعاً. هذه المعايير الخمسة التي تُسقط معظم ما يصلنا.",
    excerpt_en:
      "We passed on 31 deals last year and did four. These five filters eliminate most of what reaches us.",
    body_ar:
      "الفلتر الأول: هل نستطيع شرح مصدر العائد في فقرة واحدة؟ إن احتجنا صفحة، فالصفقة معقّدة أكثر مما ينبغي.\n\nالثاني: ماذا يحدث إذا تأخر التخارج سنتين؟ إن كان الجواب «خسارة»، فالهامش ضيق جداً.\n\nالثالث: من يخسر قبلنا؟ نفضّل الصفقات التي يكون فيها المؤسس أو البائع معرّضاً للخسارة قبلنا.\n\nالرابع: هل الرقم الأساسي قابل للتحقق من طرف ثالث؟ الخامس: هل نرتاح للإدارة بما يكفي للاتصال بهم في أسوأ يوم؟ رفض واحد من هذه الخمسة يكفي لإنهاء النقاش.",
    body_en:
      "Filter one: can we explain the source of return in a single paragraph? If it takes a page, the deal is more complicated than it should be.\n\nTwo: what happens if the exit slips by two years? If the answer is a loss, the margin is too thin.\n\nThree: who loses before we do? We prefer deals where a founder or seller is exposed ahead of us.\n\nFour: is the key number verifiable by a third party? Five: are we comfortable enough with management to call them on the worst day? A single failure among the five ends the discussion.",
    author_ar: "لجنة الاستثمار",
    author_en: "Investment Committee",
    reading_minutes: 4,
    file_url: null,
    tone: "plum",
    published: true,
    published_at: "2026-02-19T08:00:00Z",
  },
  {
    id: "post-6",
    slug: "q4-2025-report",
    kind: "report",
    title_ar: "التقرير السنوي — 2025",
    title_en: "Annual report — 2025",
    excerpt_ar:
      "أقوى سنة في سجل الصندوق: عائد صافٍ 15.4%، وتخارج مكتمل من مستودعات الدمام بمضاعف 1.83×.",
    excerpt_en:
      "The fund's strongest year on record: 15.4% net return and a completed exit from Dammam at a 1.83x multiple.",
    body_ar:
      "أنهى الصندوق 2025 بعائد صافٍ 15.4% بعد الرسوم، وهو أعلى رقم منذ التأسيس.\n\nالمساهم الأكبر كان التخارج من مستودعات الدمام المبرّدة عند 23.6 مليون دولار مقابل تكلفة دخول 14.2 مليون. والمساهم الثاني كان إعادة تقييم المحفظة اللوجستية.\n\nننبّه الشركاء إلى أن هذا الرقم استثنائي ولا يمثّل توقّعنا للسنوات القادمة؛ العائد المستهدف على المدى الطويل يبقى في نطاق 12% – 15%.",
    body_en:
      "The fund closed 2025 at a 15.4% net return after fees — its highest since inception.\n\nThe largest contributor was the Dammam cold storage exit at $23.6M against a $14.2M entry cost, followed by the revaluation of the logistics book.\n\nWe remind partners that this figure is exceptional and not our expectation for coming years; the long-term target return remains in the 12% – 15% range.",
    author_ar: "لجنة الاستثمار",
    author_en: "Investment Committee",
    reading_minutes: 7,
    file_url: null,
    tone: "gold",
    published: true,
    published_at: "2026-01-20T08:00:00Z",
  },
];

export const seedNavSeries: NavPoint[] = [
  { period: "2017", value: 100 },
  { period: "2018", value: 109.4 },
  { period: "2019", value: 121.8 },
  { period: "2020", value: 118.2 },
  { period: "2021", value: 137.6 },
  { period: "2022", value: 155.1 },
  { period: "2023", value: 171.9 },
  { period: "2024", value: 196.4 },
  { period: "2025", value: 226.7 },
  { period: "2026", value: 243.5 },
];

export const seedAllocation: AllocationSlice[] = [
  { sector: "real_estate", weight: 52 },
  { sector: "equities", weight: 26 },
  { sector: "ventures", weight: 13 },
  { sector: "cash", weight: 9 },
];

export const seedAnnualReturns: AnnualReturn[] = [
  { year: 2018, net_return: 9.4 },
  { year: 2019, net_return: 11.3 },
  { year: 2020, net_return: -3.0 },
  { year: 2021, net_return: 16.4 },
  { year: 2022, net_return: 12.7 },
  { year: 2023, net_return: 10.8 },
  { year: 2024, net_return: 14.3 },
  { year: 2025, net_return: 15.4 },
];

export const seedKpis: PortfolioKpis = {
  nav: 186_400_000,
  irr: 14.2,
  cash_yield: 6.8,
  max_drawdown: -8.6,
  deals: 34,
  exits: 11,
  as_of: "2026-06-30T00:00:00Z",
};

export const seedTeam: TeamMember[] = [
  {
    initials: "ع م",
    name_ar: "عبدالله المطيري",
    name_en: "Abdullah Al-Mutairi",
    role_ar: "الشريك المؤسس ومدير الاستثمار",
    role_en: "Founding Partner & CIO",
    bio_ar: "ستة عشر عاماً في التطوير والتمويل العقاري، قاد صفقات بقيمة تتجاوز 400 مليون دولار.",
    bio_en: "Sixteen years in real-estate development and finance, leading deals worth over $400M.",
  },
  {
    initials: "ن ق",
    name_ar: "نورة القحطاني",
    name_en: "Noura Al-Qahtani",
    role_ar: "مديرة محفظة الأسهم",
    role_en: "Head of Public Equities",
    bio_ar: "أحد عشر عاماً في إدارة محافظ أسهم خليجية، حاصلة على شهادة CFA.",
    bio_en: "Eleven years managing GCC equity portfolios; CFA charterholder.",
  },
  {
    initials: "ف س",
    name_ar: "فهد السبيعي",
    name_en: "Fahad Al-Subaie",
    role_ar: "مدير الاستثمار في المشاريع",
    role_en: "Head of Ventures",
    bio_ar: "مؤسس سابق لشركتين تقنيتين، وأكمل تخارجاً واحداً قبل الانضمام للفريق.",
    bio_en: "Former founder of two technology companies with one completed exit before joining.",
  },
  {
    initials: "ر ح",
    name_ar: "ريم الحربي",
    name_en: "Reem Al-Harbi",
    role_ar: "مديرة المخاطر والالتزام",
    role_en: "Head of Risk & Compliance",
    bio_ar: "تسع سنوات في التدقيق الداخلي والالتزام لدى مؤسسات مالية مرخّصة.",
    bio_en: "Nine years in internal audit and compliance at licensed financial institutions.",
  },
];
