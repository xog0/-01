// Company model: career ladder, departments, starting team, default tasks,
// and persistence in localStorage.

export const LADDER = [
  { key: 'intern', name: 'متدرب', xp: 0, desc: 'يتعلم أساسيات العمل وينفذ مهاماً بسيطة تحت إشراف.' },
  { key: 'junior', name: 'أخصائي مبتدئ', xp: 40, desc: 'ينفذ مهام محددة بشكل مستقل مع مراجعة.' },
  { key: 'specialist', name: 'أخصائي', xp: 100, desc: 'مسؤول عن مخرجات كاملة في تخصصه.' },
  { key: 'senior', name: 'أخصائي أول', xp: 180, desc: 'خبير في تخصصه ويوجّه الأقل خبرة.' },
  { key: 'lead', name: 'قائد فريق', xp: 280, desc: 'يقود فريقاً صغيراً ويوزع المهام اليومية.' },
  { key: 'manager', name: 'مدير', xp: 400, desc: 'يدير قسماً كاملاً ويضع خططه.' },
  { key: 'director', name: 'مدير إدارة', xp: 550, desc: 'يشرف على عدة أقسام ويتابع الأداء العام.' },
  { key: 'cmo', name: 'الرئيس التنفيذي للتسويق', xp: 750, desc: 'يقود استراتيجية التسويق للوكالة كلها.' },
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
};

export function titleFor(emp) {
  if (emp.customTitle) return emp.customTitle;
  const level = LADDER[emp.level];
  const dept = DEPARTMENTS[emp.dept];
  if (emp.level >= 7) return level.name;
  if (emp.level >= 5) return `${level.name} ${dept.name}`;
  return `${level.name} ${dept.role}`;
}

export const TASK_XP = { low: 10, medium: 20, high: 35 };
export const PRIORITY_NAMES = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية' };
export const STATUS_NAMES = { todo: 'قيد الانتظار', doing: 'قيد التنفيذ', done: 'مكتملة' };

const STARTING_TEAM = [
  { id: 'e1', name: 'سارة', gender: 'f', dept: 'strategy', level: 5, xp: 420,
    personality: 'قيادية هادئة، تفكر بالأرقام والأهداف، تحب الوضوح وتطرح أسئلة ذكية قبل البدء.' },
  { id: 'e2', name: 'خالد', gender: 'm', dept: 'content', level: 3, xp: 195,
    personality: 'مبدع وصاحب حس لغوي عالٍ، يحب العناوين الجذابة والقصص، مرح في حديثه.' },
  { id: 'e3', name: 'ليلى', gender: 'f', dept: 'social', level: 2, xp: 120,
    personality: 'نشيطة وتتابع الترندات لحظة بلحظة، عملية وسريعة، تحب الأفكار القابلة للانتشار.' },
  { id: 'e4', name: 'عمر', gender: 'm', dept: 'ads', level: 2, xp: 105,
    personality: 'تحليلي ودقيق، لا يقتنع إلا بالبيانات، يقترح دائماً طريقة لقياس النتائج.' },
];

const DEFAULT_TASKS = [
  ['e1', 'إعداد الخطة التسويقية للربع القادم', 'ضع خطة تسويقية لثلاثة أشهر للوكالة: الأهداف، القنوات، الميزانية التقديرية، ومؤشرات الأداء.', 'high'],
  ['e1', 'تحليل المنافسين الرئيسيين', 'حدد أهم 3 أنواع من المنافسين لوكالة تسويق رقمي ناشئة، ونقاط قوتهم وضعفهم، وكيف نتميز عنهم.', 'medium'],
  ['e2', 'كتابة نص صفحة "من نحن"', 'اكتب نصاً جذاباً لصفحة "من نحن" في موقع الوكالة، لا يتجاوز 200 كلمة.', 'medium'],
  ['e2', 'خمس أفكار مقالات للمدونة', 'اقترح 5 عناوين مقالات لمدونة الوكالة مع فقرة تعريفية قصيرة لكل منها.', 'low'],
  ['e3', 'تقويم محتوى أسبوعي لإنستغرام', 'جهّز تقويم نشر لمدة 7 أيام لحساب الوكالة على إنستغرام: الفكرة، نوع المنشور، النص، والوسوم.', 'high'],
  ['e3', 'تحليل الترندات الحالية', 'اقترح 3 ترندات أو صيغ محتوى رائجة يمكن للوكالة استغلالها هذا الشهر وكيف.', 'low'],
  ['e4', 'هيكلة أول حملة إعلانية على ميتا', 'اقترح هيكل حملة إعلانية (الحملات، المجموعات، الجمهور، الإعلانات) بميزانية 1000 دولار شهرياً لجذب عملاء للوكالة.', 'high'],
  ['e4', 'لوحة مؤشرات الأداء', 'حدد أهم 8 مؤشرات أداء يجب أن نتابعها أسبوعياً مع طريقة حساب كل مؤشر.', 'medium'],
];

const STORE_KEY = 'ai-agency-state-v1';

export function createInitialState() {
  const now = Date.now();
  return {
    company: { name: 'وكالة آفاق للتسويق الرقمي', about: 'وكالة تسويق رقمي ناشئة تقدم خدمات الاستراتيجية والمحتوى والتواصل الاجتماعي والإعلانات المدفوعة.' },
    employees: STARTING_TEAM.map((e, i) => ({ ...e, desk: i, managerId: e.id === 'e1' ? null : 'e1', hiredAt: now, status: 'idle' })),
    tasks: DEFAULT_TASKS.map(([empId, title, description, priority], i) => ({
      id: `t${i + 1}`, empId, title, description, priority, status: 'todo', output: '', createdAt: now,
    })),
    chats: {},
    meetings: [],
    nextId: 100,
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.employees) && Array.isArray(s.tasks)) {
        s.employees.forEach((e) => { e.status = 'idle'; });
        s.tasks.forEach((t) => { if (t.status === 'doing') t.status = 'todo'; });
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
