// Company model: career ladder, departments, starting team, default tasks,
// and persistence in localStorage.
import { createFinance, defaultSalary } from './finance.js';

// Seats: desks 0..24 are the open-plan area. 25 is the CEO suite at the end
// of the executive wing, 26..33 are private offices for managers (level
// "مدير" and above).
export const OPEN_DESKS = 25;
export const CEO_SUITE = OPEN_DESKS;
export const PRIVATE_OFFICES = 9; // the suite plus 8 offices
export const MAX_DESKS = OPEN_DESKS + PRIVATE_OFFICES;
export const MANAGER_LEVEL = 5;
export const CEO_LEVEL = 8;
export const isPrivateOffice = (desk) => desk >= OPEN_DESKS;

/** A free seat for someone at this level: the CEO gets the suite, managers a
 *  private office when one is free, everyone else (and managers when the wing
 *  is full) an open desk. */
export function freeSeat(state, level, { officeOnly = false, openOnly = false } = {}) {
  const used = new Set(state.employees.map((e) => e.desk));
  const offices = [...Array(PRIVATE_OFFICES).keys()].map((k) => OPEN_DESKS + k)
    .filter((d) => !used.has(d) && (d !== CEO_SUITE || level >= CEO_LEVEL));
  const open = [...Array(OPEN_DESKS).keys()].filter((d) => !used.has(d));
  if (officeOnly) return offices[0];
  if (openOnly || level < MANAGER_LEVEL) return open[0];
  return offices[0] ?? open[0];
}

export const LADDER = [
  { key: 'intern', name: 'متدرب', xp: 0, desc: 'يتعلم أساسيات العمل وينفذ مهاماً بسيطة تحت إشراف.' },
  { key: 'junior', name: 'أخصائي مبتدئ', xp: 40, desc: 'ينفذ مهام محددة بشكل مستقل مع مراجعة.' },
  { key: 'specialist', name: 'أخصائي', xp: 100, desc: 'مسؤول عن مخرجات كاملة في تخصصه.' },
  { key: 'senior', name: 'أخصائي أول', xp: 180, desc: 'خبير في تخصصه ويوجّه الأقل خبرة.' },
  { key: 'lead', name: 'قائد فريق', xp: 280, desc: 'يقود فريقاً صغيراً ويوزع المهام اليومية.' },
  { key: 'manager', name: 'مدير', xp: 400, desc: 'يدير قسماً كاملاً ويضع خططه.' },
  { key: 'director', name: 'مدير إدارة', xp: 550, desc: 'يشرف على عدة أقسام ويتابع الأداء العام.' },
  { key: 'gm', name: 'المدير العام', xp: 750, desc: 'يدير عمليات الوكالة اليومية ويشرف على كل الأقسام ومدرائها.' },
  { key: 'ceo', name: 'المدير التنفيذي', xp: 1000, desc: 'أعلى منصب في الوكالة: يضع الرؤية والاستراتيجية العامة ويتخذ القرارات الكبرى.' },
];

export const DEPARTMENTS = {
  strategy: { name: 'الاستراتيجية والإدارة', role: 'استراتيجية التسويق', color: 0x7c5cff,
    skills: 'تخطيط الحملات، تحليل السوق والمنافسين، تحديد الجمهور المستهدف، إدارة الميزانيات' },
  content: { name: 'المحتوى', role: 'كتابة المحتوى', color: 0xff8a3d,
    skills: 'كتابة إعلانية، مقالات ومدونات، نصوص فيديو، صياغة الرسائل التسويقية، سرد القصص' },
  social: { name: 'التواصل الاجتماعي', role: 'التواصل الاجتماعي', color: 0x2ec4b6,
    skills: 'إدارة حسابات إنستغرام وتيك توك وإكس ولينكدإن، تقويم النشر، التفاعل مع الجمهور، الترندات' },
  ads: { name: 'الإعلانات والتحليلات', role: 'الإعلانات المدفوعة والتحليلات', color: 0x3a86ff,
    skills: 'إعلانات ميتا وجوجل، اختبارات A/B، قياس العائد على الإنفاق، لوحات المؤشرات' },
  design: { name: 'التصميم الإبداعي', role: 'التصميم الإبداعي', color: 0xff4d8d,
    skills: 'الهوية البصرية، أفكار التصاميم، توجيه فني، كتابة موجهات صور، تصميم إعلانات' },
  seo: { name: 'تحسين محركات البحث', role: 'تحسين محركات البحث', color: 0x8ac926,
    skills: 'بحث الكلمات المفتاحية، تحسين الصفحات، بناء الروابط، تحليل الظهور في البحث' },
  pr: { name: 'العلاقات العامة', role: 'العلاقات العامة', color: 0xffbe0b,
    skills: 'البيانات الصحفية، التواصل مع المؤثرين والإعلام، إدارة السمعة، الأزمات' },
  email: { name: 'التسويق بالبريد', role: 'التسويق بالبريد والأتمتة', color: 0x00b4d8,
    skills: 'سلاسل البريد، تقسيم الجمهور، أتمتة رحلة العميل، تحسين معدلات الفتح والنقر' },
  marketing: { name: 'التسويق', role: 'التسويق', color: 0xf15bb5,
    skills: 'قيادة الحملات التسويقية، تنسيق أقسام المحتوى والتواصل والإعلانات، خطط الإطلاق، قياس أثر التسويق على النمو' },
  sales: { name: 'المبيعات', role: 'المبيعات', color: 0xef233c,
    skills: 'جذب العملاء وتأهيلهم، العروض والتسعير، إدارة مسار المبيعات، التفاوض وإغلاق الصفقات، علاقات العملاء' },
  hr: { name: 'الموارد البشرية', role: 'الموارد البشرية', color: 0x9b5de5,
    skills: 'التوظيف والمقابلات، تقييم الأداء، المسارات الوظيفية والترقيات، التدريب، سياسات العمل وثقافة الفريق' },
  executive: { name: 'الإدارة التنفيذية', role: 'الإدارة التنفيذية', color: 0xe9c46a,
    skills: 'الرؤية والاستراتيجية العامة، الإدارة المالية، قيادة المدراء، اتخاذ القرارات الكبرى، تطوير الأعمال' },
  finance: { name: 'المالية', role: 'المحاسبة والمالية', color: 0x06d6a0,
    skills: 'الرواتب والخصومات والعمل الإضافي، المحاسبة والقيود، الميزانيات والتدفق النقدي، التقارير المالية، ضبط المصروفات' },
};

// Named positions offered in the hire form. Unique ones can be held by one person.
export const POSITIONS = [
  { key: 'ceo', name: 'المدير التنفيذي', dept: 'executive', level: 8, unique: true },
  { key: 'gm', name: 'المدير العام', dept: 'executive', level: 7, unique: true },
  { key: 'marketing', name: 'مدير التسويق', dept: 'marketing', level: 5, unique: true, reportsTo: 'ceo' },
  { key: 'sales', name: 'مدير المبيعات', dept: 'sales', level: 5, unique: true, reportsTo: 'ceo' },
  { key: 'hr', name: 'مدير الموارد البشرية', dept: 'hr', level: 5, unique: true, reportsTo: 'ceo' },
  { key: 'cfo', name: 'المدير المالي', dept: 'finance', level: 6, unique: true, reportsTo: 'ceo' },
];

export function titleFor(emp) {
  if (emp.customTitle) return emp.customTitle;
  const position = POSITIONS.find((p) => p.dept === emp.dept && p.level === emp.level);
  if (position) return position.name;
  const level = LADDER[emp.level];
  const dept = DEPARTMENTS[emp.dept];
  if (emp.level >= 7) return level.name;
  if (emp.level >= 5) return `${level.name} ${dept.name}`;
  return `${level.name} ${dept.role}`;
}

// Job-specific starter tasks per department. A manager uses these when the
// AI is unavailable or its answer can't be read.
export const ROLE_TASKS = {
  strategy: [
    ['تحديد أهداف الشهر القادم', 'ضع 3 أهداف تسويقية للشهر القادم وفق صيغة SMART مع مؤشر قياس لكل هدف.', 'high'],
    ['تحليل شرائح الجمهور', 'حدّد 3 شرائح جمهور أساسية للوكالة، واحتياجات كل شريحة، والرسالة المناسبة لها.', 'medium'],
    ['توزيع الميزانية التسويقية', 'اقترح توزيعاً لميزانية شهرية قدرها 3000 دولار على القنوات مع تبرير كل بند.', 'medium'],
  ],
  content: [
    ['سلسلة منشورات تعريفية بالوكالة', 'اكتب 5 منشورات قصيرة تعرّف بخدمات الوكالة، لكل منشور عنوان جذاب ودعوة لاتخاذ إجراء.', 'high'],
    ['مقال مدونة عن التسويق الرقمي', 'اكتب مقالاً من 600 كلمة بعنوان "5 أخطاء تسويقية تكلّف الشركات الناشئة عملاءها".', 'medium'],
    ['نص فيديو قصير', 'اكتب نص فيديو مدته 45 ثانية يشرح لماذا يختار العملاء وكالتنا.', 'low'],
  ],
  social: [
    ['خطة تفاعل أسبوعية', 'ضع خطة لزيادة التفاعل على إنستغرام وتيك توك لمدة أسبوع: أنواع المحتوى، أوقات النشر، وأفكار القصص.', 'high'],
    ['أفكار ريلز رائجة', 'اقترح 5 أفكار ريلز مناسبة لوكالة تسويق مع وصف المشهد والنص الظاهر على الشاشة.', 'medium'],
    ['ردود جاهزة للتعليقات', 'اكتب 10 ردود احترافية جاهزة على أكثر التعليقات والاستفسارات شيوعاً.', 'low'],
  ],
  ads: [
    ['نصوص إعلانية لاختبار A/B', 'اكتب نسختين مختلفتين لإعلان ميتا (عنوان، نص، دعوة لإجراء) مع الفرضية التي يختبرها كل منهما.', 'high'],
    ['خطة حملة بحث على جوجل', 'اقترح 3 مجموعات إعلانية لحملة بحث على جوجل مع الكلمات المفتاحية والكلمات السلبية لكل مجموعة.', 'medium'],
    ['تقرير أداء أسبوعي نموذجي', 'صمّم قالب تقرير أداء أسبوعي للإعلانات مع المؤشرات وطريقة قراءة كل مؤشر.', 'low'],
  ],
  design: [
    ['دليل هوية بصرية مختصر', 'اقترح لوحة ألوان وخطوطاً وأسلوب صور لهوية الوكالة مع سبب كل اختيار.', 'high'],
    ['أفكار تصاميم إعلانية', 'اقترح 4 أفكار تصاميم إعلانية للحملة القادمة مع وصف التكوين والنص على كل تصميم.', 'medium'],
    ['موجهات صور بالذكاء الاصطناعي', 'اكتب 5 موجهات تفصيلية لتوليد صور تسويقية متسقة مع هوية الوكالة.', 'low'],
  ],
  seo: [
    ['بحث كلمات مفتاحية', 'اقترح 15 كلمة مفتاحية لخدمات الوكالة مقسمة حسب نية البحث، مع أولوية كل منها.', 'high'],
    ['تحسين صفحة الخدمات', 'اكتب عنوان SEO ووصفاً تعريفياً وعناوين فرعية مقترحة لصفحة خدمات الوكالة.', 'medium'],
    ['خطة روابط خلفية', 'اقترح 5 طرق عملية لبناء روابط خلفية لموقع الوكالة خلال الشهر القادم.', 'low'],
  ],
  pr: [
    ['بيان صحفي', 'اكتب بياناً صحفياً عن إطلاق الوكالة وخدماتها لا يتجاوز 300 كلمة.', 'high'],
    ['قائمة مؤثرين مستهدفين', 'حدّد 3 فئات من المؤثرين المناسبين للتعاون ومعايير اختيارهم ورسالة تواصل أولى.', 'medium'],
    ['خطة إدارة أزمة', 'ضع خطة مختصرة للتعامل مع تعليق سلبي ينتشر عن الوكالة: الخطوات والردود.', 'low'],
  ],
  marketing: [
    ['خطة تسويق ربع سنوية', 'ضع خطة تسويق للربع القادم تربط أهداف المحتوى والتواصل والإعلانات بهدف نمو واحد واضح.', 'high'],
    ['خطة إطلاق خدمة جديدة', 'جهّز خطة إطلاق لخدمة جديدة من الوكالة: الرسالة، القنوات، الجدول الزمني، ومؤشرات النجاح.', 'medium'],
    ['مراجعة أداء الحملات', 'صمّم إطاراً شهرياً لمراجعة أداء كل الحملات وتحديد ما يُوقف وما يُضاعف.', 'low'],
  ],
  sales: [
    ['عرض أسعار باقات الوكالة', 'صمّم 3 باقات خدمات للوكالة مع مكونات كل باقة وسعرها المقترح ولمن تناسب.', 'high'],
    ['نص مكالمة مبيعات', 'اكتب نص مكالمة أولى مع عميل محتمل: الافتتاح، أسئلة الاكتشاف، الرد على الاعتراضات، والإغلاق.', 'medium'],
    ['قائمة عملاء مستهدفين', 'حدّد 5 قطاعات مناسبة لعملاء الوكالة مع سبب الاختيار وطريقة الوصول لكل قطاع.', 'medium'],
  ],
  hr: [
    ['وصف وظيفي لمنصب شاغر', 'اكتب وصفاً وظيفياً كاملاً لمنصب أخصائي تسويق رقمي: المهام، المؤهلات، والمهارات.', 'high'],
    ['نموذج تقييم أداء', 'صمّم نموذج تقييم أداء ربع سنوي للموظفين مع معايير واضحة ومقياس لكل معيار.', 'medium'],
    ['خطة تهيئة الموظف الجديد', 'ضع خطة تهيئة لأول أسبوعين للموظف الجديد: اليوم الأول، التدريب، والأهداف الأولى.', 'medium'],
  ],
  finance: [
    ['إعداد ميزانية الربع القادم', 'ضع ميزانية تشغيلية للربع القادم: الرواتب، الإعلانات، الأدوات، والمصروفات العامة، مع هامش احتياطي.', 'high'],
    ['سياسة المكافآت والخصومات', 'اكتب سياسة واضحة للمكافآت والخصومات والعمل الإضافي في الوكالة، مع أمثلة وحدود لكل بند.', 'medium'],
    ['تقرير التدفق النقدي', 'صمّم قالب تقرير شهري للتدفق النقدي يوضح الإيرادات والمصروفات والرصيد المتوقع.', 'low'],
  ],
  executive: [
    ['رؤية الوكالة لثلاث سنوات', 'اكتب رؤية ورسالة وقيم الوكالة مع 3 أهداف استراتيجية للسنوات الثلاث القادمة.', 'high'],
    ['مؤشرات أداء الإدارة العليا', 'حدّد أهم 6 مؤشرات تتابعها الإدارة العليا شهرياً مع المستهدف لكل مؤشر.', 'medium'],
    ['خطة نمو الإيرادات', 'ضع خطة لمضاعفة إيرادات الوكالة خلال سنة: مصادر النمو، الاستثمارات المطلوبة، والمخاطر.', 'medium'],
  ],
  email: [
    ['سلسلة ترحيب بالبريد', 'اكتب سلسلة من 3 رسائل ترحيبية للعملاء الجدد مع عنوان كل رسالة وتوقيت إرسالها.', 'high'],
    ['نشرة شهرية', 'جهّز محتوى نشرة بريدية شهرية للعملاء: الأقسام، العناوين، والنصوص.', 'medium'],
    ['تقسيم قائمة البريد', 'اقترح طريقة لتقسيم قائمة المشتركين إلى شرائح مع الرسالة المناسبة لكل شريحة.', 'low'],
  ],
};

export const TASK_XP = { low: 10, medium: 20, high: 35 };
export const PRIORITY_NAMES = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية' };
export const STATUS_NAMES = { todo: 'قيد الانتظار', doing: 'قيد التنفيذ', review: 'بانتظار المراجعة', done: 'مكتملة' };

const HAMO = { id: 'e5', name: 'حمو', gender: 'm', dept: 'executive', level: 8, xp: 1000, managerId: null,
    personality: 'قائد صاحب رؤية، حاسم وهادئ، يركّز على النمو والصورة الكبيرة ويطلب من الفريق نتائج واضحة.' };

// The finance manager: runs payroll and keeps the books.
const SHEIKA = { id: 'e6', name: 'شيكا', gender: 'm', dept: 'finance', level: 6, xp: 560, managerId: 'e5',
  personality: 'محاسب دقيق ومنظم، حازم في الأرقام لكنه منصف، يشرح الحسابات ببساطة ويحب الجداول الواضحة.' };

const STARTING_TEAM = [
  HAMO,
  SHEIKA,
  { id: 'e1', name: 'سارة', gender: 'f', dept: 'strategy', level: 5, xp: 420, managerId: 'e5',
    personality: 'قيادية هادئة، تفكر بالأرقام والأهداف، تحب الوضوح وتطرح أسئلة ذكية قبل البدء.' },
  { id: 'e2', managerId: 'e1', name: 'خالد', gender: 'm', dept: 'content', level: 3, xp: 195,
    personality: 'مبدع وصاحب حس لغوي عالٍ، يحب العناوين الجذابة والقصص، مرح في حديثه.' },
  { id: 'e3', managerId: 'e1', name: 'ليلى', gender: 'f', dept: 'social', level: 2, xp: 120,
    personality: 'نشيطة وتتابع الترندات لحظة بلحظة، عملية وسريعة، تحب الأفكار القابلة للانتشار.' },
  { id: 'e4', managerId: 'e1', name: 'عمر', gender: 'm', dept: 'ads', level: 2, xp: 105,
    personality: 'تحليلي ودقيق، لا يقتنع إلا بالبيانات، يقترح دائماً طريقة لقياس النتائج.' },
];

const DEFAULT_TASKS = [
  ['e6', 'إعداد ميزانية الربع القادم', 'ضع ميزانية تشغيلية للربع القادم: الرواتب، الإعلانات، الأدوات، والمصروفات العامة، مع هامش احتياطي.', 'high'],
  ['e6', 'سياسة المكافآت والخصومات', 'اكتب سياسة واضحة للمكافآت والخصومات والعمل الإضافي في الوكالة، مع أمثلة وحدود لكل بند.', 'medium'],
  ['e5', 'رؤية الوكالة لثلاث سنوات', 'اكتب رؤية ورسالة وقيم الوكالة مع 3 أهداف استراتيجية للسنوات الثلاث القادمة.', 'high'],
  ['e5', 'مؤشرات أداء الإدارة العليا', 'حدّد أهم 6 مؤشرات تتابعها الإدارة العليا شهرياً مع المستهدف لكل مؤشر.', 'medium'],
  ['e1', 'إعداد الخطة التسويقية للربع القادم', 'ضع خطة تسويقية لثلاثة أشهر للوكالة: الأهداف، القنوات، الميزانية التقديرية، ومؤشرات الأداء.', 'high'],
  ['e1', 'تحليل المنافسين الرئيسيين', 'حدد أهم 3 أنواع من المنافسين لوكالة تسويق رقمي ناشئة، ونقاط قوتهم وضعفهم، وكيف نتميز عنهم.', 'medium'],
  ['e2', 'كتابة نص صفحة "من نحن"', 'اكتب نصاً جذاباً لصفحة "من نحن" في موقع الوكالة، لا يتجاوز 200 كلمة.', 'medium'],
  ['e2', 'خمس أفكار مقالات للمدونة', 'اقترح 5 عناوين مقالات لمدونة الوكالة مع فقرة تعريفية قصيرة لكل منها.', 'low'],
  ['e3', 'تقويم محتوى أسبوعي لإنستغرام', 'جهّز تقويم نشر لمدة 7 أيام لحساب الوكالة على إنستغرام: الفكرة، نوع المنشور، النص، والوسوم.', 'high'],
  ['e3', 'تحليل الترندات الحالية', 'اقترح 3 ترندات أو صيغ محتوى رائجة يمكن للوكالة استغلالها هذا الشهر وكيف.', 'low'],
  ['e4', 'هيكلة أول حملة إعلانية على ميتا', 'اقترح هيكل حملة إعلانية (الحملات، المجموعات، الجمهور، الإعلانات) بميزانية 1000 دولار شهرياً لجذب عملاء للوكالة.', 'high'],
  ['e4', 'لوحة مؤشرات الأداء', 'حدد أهم 8 مؤشرات أداء يجب أن نتابعها أسبوعياً مع طريقة حساب كل مؤشر.', 'medium'],
];

// One intern per department; each reports to the head of their department.
const INTERNS = [
  { dept: 'executive', name: 'يوسف', gender: 'm', personality: 'منظم ودقيق في المتابعة، يحب فهم الصورة الكاملة قبل التنفيذ.' },
  { dept: 'strategy', name: 'رنا', gender: 'f', personality: 'فضولية وتحب البحث وجمع البيانات، تسأل كثيراً لتتعلم.' },
  { dept: 'marketing', name: 'زياد', gender: 'm', personality: 'متحمس ومليء بالأفكار، يتعلم بسرعة من الملاحظات.' },
  { dept: 'sales', name: 'مازن', gender: 'm', personality: 'اجتماعي ولبق في الحديث، صبور مع العملاء.' },
  { dept: 'hr', name: 'دانة', gender: 'f', personality: 'ودودة ومنظمة، تهتم براحة الفريق وتحب الترتيب.' },
  { dept: 'content', name: 'سلمى', gender: 'f', personality: 'تحب القراءة والكتابة، أسلوبها بسيط وواضح.' },
  { dept: 'social', name: 'فيصل', gender: 'm', personality: 'يعيش على المنصات ويلتقط الترندات بسرعة.' },
  { dept: 'ads', name: 'لينا', gender: 'f', personality: 'تحب الأرقام والجداول وتتعلم أدوات الإعلانات بشغف.' },
  { dept: 'design', name: 'تالا', gender: 'f', personality: 'ذوقها بصري عالٍ، تجرب الألوان والأفكار الجديدة.' },
  { dept: 'seo', name: 'كريم', gender: 'm', personality: 'صبور ومنهجي، يحب التفاصيل التقنية.' },
  { dept: 'pr', name: 'جود', gender: 'f', personality: 'لبقة وهادئة، تختار كلماتها بعناية.' },
  { dept: 'email', name: 'ماجد', gender: 'm', personality: 'عملي ويحب الأتمتة وتوفير الوقت.' },
];

/** Adds the interns a department doesn't have yet; returns how many joined. */
function addInterns(state) {
  const byRankDesc = (a, b) => b.level - a.level || (b.xp || 0) - (a.xp || 0);
  const hamo = state.employees.find((e) => e.name === HAMO.name);
  let added = 0;
  for (const it of INTERNS) {
    if (state.employees.some((e) => e.dept === it.dept && e.level === 0)) continue;
    const desk = freeSeat(state, 0);
    if (desk === undefined) break; // open area is full
    const head = state.employees.filter((e) => e.dept === it.dept).sort(byRankDesc)[0] || hamo || null;
    const id = newId(state, 'e');
    state.employees.push({ ...it, id, level: 0, xp: 0, desk, managerId: head ? head.id : null, salary: defaultSalary(0), hiredAt: Date.now(), status: 'idle' });
    const [title, description] = ROLE_TASKS[it.dept].at(-1);
    state.tasks.push({ id: newId(state, 't'), empId: id, title, description, priority: 'low', status: 'todo', output: '',
      createdAt: Date.now(), assignedBy: head ? head.id : null });
    added += 1;
  }
  return added;
}

// ---- who people are: appearance and background ---------------------------
// Named people have a fixed look and story; anyone else gets one derived from
// their id, so it stays the same on every device without being stored.
const LOOKS = {
  'حمو': { hair: 'short', skin: 1, hairColor: 2, beard: true, height: 1.05 },
  'سارة': { hair: 'hijab', hijab: 0x1e2a4a, skin: 0, glasses: true },
  'خالد': { hair: 'curly', skin: 2, hairColor: 0, beard: true },
  'ليلى': { hair: 'long', skin: 3, hairColor: 3, height: 0.96 },
  'عمر': { hair: 'buzz', skin: 1, hairColor: 2, glasses: true },
  'شيكا': { hair: 'short', skin: 1, hairColor: 2, glasses: true, beard: true },
  'يوسف': { hair: 'short', skin: 2, hairColor: 2, beard: true },
  'رنا': { hair: 'hijab', hijab: 0xcbb994, skin: 0, height: 0.95 },
  'زياد': { hair: 'short', skin: 3, hairColor: 1 },
  'مازن': { hair: 'buzz', skin: 1, hairColor: 2, beard: true, height: 1.04 },
  'دانة': { hair: 'hijab', hijab: 0x6b1f2e, skin: 1 },
  'سلمى': { hair: 'long', skin: 0, hairColor: 0, glasses: true },
  'فيصل': { hair: 'curly', skin: 2, hairColor: 2 },
  'لينا': { hair: 'bun', skin: 3, hairColor: 3, height: 0.95 },
  'تالا': { hair: 'long', skin: 1, hairColor: 1 },
  'كريم': { hair: 'short', skin: 0, hairColor: 0, glasses: true },
  'جود': { hair: 'hijab', hijab: 0x15151a, skin: 3 },
  'ماجد': { hair: 'short', skin: 1, hairColor: 2, beard: true },
};

const BIOS = {
  'حمو': { age: 46, years: 22, background: 'بدأ في المبيعات، ثم أسس وأدار وكالتين قبل أن يقود الوكالة. يحمل ماجستير في إدارة الأعمال.',
    style: 'يتحدث باختصار وثقة، يسأل عن الأرقام وأثر القرار على العميل، يشكر الفريق علناً وينتقد على انفراد.' },
  'شيكا': { age: 39, years: 15, background: 'محاسب قانوني عمل في التدقيق لدى مكتب محاسبة، ثم أدار الحسابات والرواتب لشركات خدمات.',
    style: 'دقيق وهادئ، يبدأ بالرقم ثم يشرحه، ويذكّر بالسياسة قبل أي استثناء.' },
  'سارة': { age: 34, years: 11, background: 'عملت في التخطيط الاستراتيجي لدى وكالة إعلانية كبيرة، وتحمل بكالوريوس تسويق وشهادة في تحليل البيانات.',
    style: 'منظمة ومباشرة، تبدأ بالهدف ثم الخطة، وتطلب مواعيد تسليم واضحة.' },
  'خالد': { age: 29, years: 6, background: 'صحفي سابق انتقل إلى الكتابة الإعلانية، وكتب لعلامات في الأغذية والسياحة.',
    style: 'ودود ومرح، يستخدم الأمثلة والقصص، ويحب أن يقترح أكثر من صيغة.' },
  'ليلى': { age: 26, years: 4, background: 'بدأت صانعة محتوى على إنستغرام، ثم أدارت حسابات متاجر إلكترونية.',
    style: 'سريعة ومتحمسة، تكتب بجمل قصيرة وتستشهد بأمثلة من المنصات.' },
  'عمر': { age: 28, years: 5, background: 'محلل بيانات سابق في شركة اتصالات، ويدير حملات ميتا وجوجل منذ ثلاث سنوات.',
    style: 'هادئ ودقيق، يربط كل رأي برقم أو تجربة، ويقترح طريقة للقياس.' },
};

function hashOf(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

/** How someone looks in the office (hair, skin, clothes by rank, height). */
export function lookFor(emp) {
  const h = hashOf(`${emp.id}:${emp.name}`);
  const female = emp.gender === 'f';
  const base = {
    hair: female ? ['long', 'bun', 'hijab'][h % 3] : ['short', 'buzz', 'curly'][h % 3],
    hijab: [0x1e2a4a, 0xcbb994, 0x6b1f2e, 0x15151a, 0x3d5a4a][(h >>> 3) % 5],
    skin: (h >>> 6) % 4,
    hairColor: (h >>> 9) % 4,
    beard: !female && (h >>> 12) % 5 < 2,
    glasses: (h >>> 15) % 4 === 0,
    height: 0.95 + ((h >>> 18) % 10) / 100,
  };
  const outfit = emp.level >= 7 ? 'suit' : emp.level >= MANAGER_LEVEL ? 'tie' : emp.level >= 3 ? 'shirt' : 'casual';
  const named = LOOKS[emp.name] ? { beard: false, glasses: false, height: 1, ...LOOKS[emp.name] } : {};
  return { ...base, ...named, outfit };
}

/** Age, experience, background and communication style for the AI persona. */
export function bioFor(emp) {
  if (BIOS[emp.name]) return BIOS[emp.name];
  const h = hashOf(`${emp.name}:${emp.id}`);
  const years = [0, 1, 3, 5, 7, 9, 12, 16, 20][emp.level] ?? 3;
  const dept = DEPARTMENTS[emp.dept]?.name || '';
  return {
    age: 22 + years + (h % 4),
    years,
    background: emp.level === 0
      ? `خريج حديث بدأ مسيرته متدرباً في قسم ${dept}، ويتعلم من زملائه.`
      : `عمل ${years} سنوات في ${dept} لدى شركات ووكالات مختلفة قبل الانضمام إلى الوكالة.`,
    style: emp.level === 0 ? 'مهذب ومتحمس، يسأل عند الشك ويعرض ما تعلمه بتواضع.' : 'مهني وواضح، يقدم رأيه مع سبب مختصر.',
  };
}

const STORE_KEY = 'ai-agency-state-v1';

export function createInitialState() {
  const now = Date.now();
  const state = {
    company: { name: 'وكالة آفاق للتسويق الرقمي', about: 'وكالة تسويق رقمي ناشئة تقدم خدمات الاستراتيجية والمحتوى والتواصل الاجتماعي والإعلانات المدفوعة.' },
    employees: [],
    tasks: DEFAULT_TASKS.map(([empId, title, description, priority], i) => ({
      id: `t${i + 1}`, empId, title, description, priority, status: 'todo', output: '', createdAt: now,
    })),
    chats: {},
    meetings: [],
    nextId: 100,
    finance: createFinance(now),
    migrations: MIGRATIONS.map((m) => m.key), // a fresh agency already has these
  };
  for (const e of STARTING_TEAM) {
    state.employees.push({ ...e, desk: freeSeat(state, e.level), salary: defaultSalary(e.level), hiredAt: now, status: 'idle' });
  }
  addInterns(state);
  return state;
}

// One-time updates to agencies saved before a change to the starting team.
// Each runs once per agency and is recorded, so undoing it (for example
// letting Hamo go) sticks.
const MIGRATIONS = [
  {
    key: 'add-hamo-ceo',
    run(state) {
      if (state.employees.some((e) => e.name === HAMO.name)) return;
      const desk = freeSeat(state, HAMO.level);
      if (desk === undefined) return; // office is full
      const id = state.employees.some((e) => e.id === HAMO.id) ? newId(state, 'e') : HAMO.id;
      state.employees.push({ ...HAMO, id, desk, salary: defaultSalary(HAMO.level), hiredAt: Date.now(), status: 'idle' });
      for (const [, title, description, priority] of DEFAULT_TASKS.filter(([who]) => who === HAMO.id)) {
        state.tasks.push({ id: newId(state, 't'), empId: id, title, description, priority, status: 'todo', output: '', createdAt: Date.now() });
      }
    },
  },
  {
    // Sara reports to Hamo; her own team stays under her.
    key: 'sara-under-hamo',
    run(state) {
      const hamo = state.employees.find((e) => e.name === HAMO.name);
      const sara = state.employees.find((e) => e.name === 'سارة');
      if (hamo && sara && hamo.managerId !== sara.id) sara.managerId = hamo.id;
    },
  },
  { key: 'marketing-under-hamo', run: (state) => deptHeadsUnderHamo(state, 'marketing') },
  { key: 'sales-under-hamo', run: (state) => deptHeadsUnderHamo(state, 'sales') },
  { key: 'hr-under-hamo', run: (state) => deptHeadsUnderHamo(state, 'hr') },
  { key: 'add-interns', run: addInterns },
  { key: 'manager-offices', run: moveManagersToOffices },
  { key: 'ceo-suite', run: ceoToSuite },
  { key: 'finance-setup', run: setUpFinance },
  { key: 'add-sheika-cfo', run: addSheika },
];

// Whoever heads a department (its members whose manager is outside it)
// reports to Hamo; their own team stays under them.
function deptHeadsUnderHamo(state, dept) {
  const hamo = state.employees.find((e) => e.name === HAMO.name);
  if (!hamo) return;
  const inDept = new Set(state.employees.filter((e) => e.dept === dept).map((e) => e.id));
  for (const e of state.employees) {
    if (inDept.has(e.id) && !inDept.has(e.managerId) && e.id !== hamo.id && hamo.managerId !== e.id) {
      e.managerId = hamo.id;
    }
  }
}

/** Managers sitting in the open area move into free private offices,
 *  highest rank first. Returns the ids of those who moved. */
/** Books for agencies saved before the finance system: salaries by level. */
function setUpFinance(state) {
  state.finance ||= createFinance();
  for (const e of state.employees) if (!(e.salary > 0)) e.salary = defaultSalary(e.level);
}

function addSheika(state) {
  if (state.employees.some((e) => e.name === SHEIKA.name)) return;
  const desk = freeSeat(state, SHEIKA.level);
  if (desk === undefined) return;
  const ceo = state.employees.filter((e) => e.level >= CEO_LEVEL).sort((a, b) => (b.xp || 0) - (a.xp || 0))[0];
  const id = state.employees.some((e) => e.id === SHEIKA.id) ? newId(state, 'e') : SHEIKA.id;
  state.employees.push({ ...SHEIKA, id, desk, managerId: ceo ? ceo.id : null, salary: defaultSalary(SHEIKA.level), hiredAt: Date.now(), status: 'idle' });
  for (const [, title, description, priority] of DEFAULT_TASKS.filter(([who]) => who === SHEIKA.id)) {
    state.tasks.push({ id: newId(state, 't'), empId: id, title, description, priority, status: 'todo', output: '', createdAt: Date.now() });
  }
}

/** The top CEO sits in the suite: swaps seats with whoever is there. */
function ceoToSuite(state) {
  const ceo = state.employees.filter((e) => e.level >= CEO_LEVEL).sort((a, b) => (b.xp || 0) - (a.xp || 0))[0];
  if (!ceo || ceo.desk === CEO_SUITE) return;
  const occupant = state.employees.find((e) => e.desk === CEO_SUITE);
  if (occupant) occupant.desk = ceo.desk;
  ceo.desk = CEO_SUITE;
}

export function moveManagersToOffices(state) {
  const moved = [];
  const managers = state.employees.filter((e) => e.level >= MANAGER_LEVEL && !isPrivateOffice(e.desk))
    .sort((a, b) => b.level - a.level || (b.xp || 0) - (a.xp || 0));
  for (const e of managers) {
    const desk = freeSeat(state, e.level, { officeOnly: true });
    if (desk === undefined) break;
    e.desk = desk;
    moved.push(e.id);
  }
  return moved;
}

/** Runs pending one-time updates on a loaded agency; returns true if any ran. */
export function applyMigrations(state) {
  state.migrations ||= [];
  let changed = false;
  for (const m of MIGRATIONS) {
    if (state.migrations.includes(m.key)) continue;
    m.run(state);
    state.migrations.push(m.key);
    changed = true;
  }
  return changed;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.employees) && Array.isArray(s.tasks)) {
        s.employees.forEach((e) => { e.status = 'idle'; });
        s.tasks.forEach((t) => { if (t.status === 'doing' || t.status === 'review') t.status = 'todo'; });
        return s;
      }
    }
  } catch { /* storage unavailable or corrupted: start fresh */ }
  return createInitialState();
}

export function saveState(state) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

export function newId(state, prefix) {
  state.nextId += 1;
  return `${prefix}${state.nextId}`;
}
