// Validates chat requests from the browser and builds the system prompt
// for each AI employee. Kept free of I/O so it can be unit-tested.

export const LIMITS = Object.freeze({
  maxHistory: 40,
  maxMessageChars: 6000,
  maxFieldChars: 200,
  maxLongFieldChars: 1200,
});

const MODES = new Set(['chat', 'task', 'meeting', 'summary']);

export class ValidationError extends Error {}

function str(value, max, field, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ValidationError(`الحقل "${field}" مطلوب`);
    return '';
  }
  if (typeof value !== 'string') throw new ValidationError(`الحقل "${field}" يجب أن يكون نصاً`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new ValidationError(`الحقل "${field}" أطول من المسموح`);
  return trimmed;
}

export function validateChatRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('طلب غير صالح');
  }
  const mode = body.mode ?? 'chat';
  if (!MODES.has(mode)) throw new ValidationError('نوع الطلب غير معروف');

  const p = body.persona;
  if (!p || typeof p !== 'object') throw new ValidationError('بيانات الموظف مفقودة');
  const persona = {
    name: str(p.name, LIMITS.maxFieldChars, 'name'),
    title: str(p.title, LIMITS.maxFieldChars, 'title'),
    level: str(p.level, LIMITS.maxFieldChars, 'level'),
    department: str(p.department, LIMITS.maxFieldChars, 'department'),
    skills: str(p.skills, LIMITS.maxLongFieldChars, 'skills', { required: false }),
    personality: str(p.personality, LIMITS.maxLongFieldChars, 'personality', { required: false }),
    manager: str(p.manager, LIMITS.maxFieldChars, 'manager', { required: false }),
  };

  const c = body.company ?? {};
  const company = {
    name: str(c.name, LIMITS.maxFieldChars, 'company.name', { required: false }) || 'الوكالة',
    about: str(c.about, LIMITS.maxLongFieldChars, 'company.about', { required: false }),
    team: str(c.team, LIMITS.maxLongFieldChars, 'company.team', { required: false }),
  };

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    throw new ValidationError('لا توجد رسائل');
  }
  // Keep only the most recent turns, then make sure the list starts with a user turn.
  let messages = body.messages.slice(-LIMITS.maxHistory).map((m, i) => {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) {
      throw new ValidationError(`دور الرسالة ${i + 1} غير صالح`);
    }
    return { role: m.role, content: str(m.content, LIMITS.maxMessageChars, `messages[${i}]`) };
  });
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages.at(-1).role !== 'user') {
    throw new ValidationError('يجب أن تنتهي المحادثة برسالة من المستخدم');
  }
  // Merge consecutive turns from the same role so the API always sees alternation.
  messages = messages.reduce((acc, m) => {
    const last = acc.at(-1);
    if (last && last.role === m.role) last.content += `\n\n${m.content}`;
    else acc.push({ ...m });
    return acc;
  }, []);

  return { mode, persona, company, messages };
}

const MODE_INSTRUCTIONS = {
  chat:
    'أنت الآن في محادثة مباشرة مع مالك الوكالة (مديرك الأعلى). أجب بإيجاز ووضوح، ' +
    'واقترح خطوات عملية عندما يناسب ذلك. لا تتجاوز 180 كلمة ما لم يُطلب منك التفصيل.',
  task:
    'كُلِّفت بمهمة عمل. نفّذها الآن وقدّم المُخرَج النهائي نفسه (وليس خطة لتنفيذه): ' +
    'نصوص جاهزة للنشر، أو خطة مفصّلة، أو تحليل، حسب طبيعة المهمة. ' +
    'استخدم عناوين قصيرة وقوائم مرقّمة. ابدأ بسطر واحد يلخص ما سلّمته.',
  meeting:
    'أنت في اجتماع فريق داخل غرفة الاجتماعات. ستصلك المحادثة حتى الآن. ' +
    'تحدث مرة واحدة فقط بصوتك أنت، من زاوية تخصصك، في 2-4 جمل. ' +
    'ابنِ على ما قاله الزملاء أو اعترض بلطف إن لزم. لا تكتب كلام غيرك ولا تضع اسمك في البداية.',
  summary:
    'أنت أعلى الحاضرين رتبة وانتهى الاجتماع للتو. اكتب محضراً موجزاً: ' +
    '1) القرارات، 2) المهام المطلوبة مع اسم المسؤول عن كل مهمة، 3) الخطوة التالية. ' +
    'لا تتجاوز 200 كلمة.',
};

export function buildSystemPrompt({ mode, persona, company }) {
  const lines = [
    `أنت ${persona.name}، تعمل بمسمى "${persona.title}" (المستوى الوظيفي: ${persona.level}) ` +
      `في قسم ${persona.department} لدى "${company.name}"، وهي وكالة تسويق يعمل فيها فريق من الموظفين.`,
  ];
  if (company.about) lines.push(`عن الوكالة: ${company.about}`);
  if (persona.manager) lines.push(`مديرك المباشر: ${persona.manager}.`);
  if (persona.skills) lines.push(`مهاراتك: ${persona.skills}`);
  if (persona.personality) lines.push(`شخصيتك وأسلوبك: ${persona.personality}`);
  if (company.team) lines.push(`زملاؤك في الفريق: ${company.team}`);
  lines.push(
    'تحدث بالعربية الفصحى المبسطة دائماً، بشخصيتك أنت، وبما يتناسب مع مستواك الوظيفي وصلاحياتك.',
    'إذا لم تتوفر لديك معلومة (أرقام حقيقية، بيانات عميل) فقل ذلك واقترح افتراضاً معقولاً بدلاً من اختلاق أرقام.',
    MODE_INSTRUCTIONS[mode],
  );
  return lines.join('\n');
}
