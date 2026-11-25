// Validates chat requests from the browser and builds the system prompt
// for each AI employee. Kept free of I/O so it can be unit-tested.

export const LIMITS = Object.freeze({
  maxHistory: 40,
  maxMessageChars: 6000,
  maxFieldChars: 200,
  maxLongFieldChars: 1200,
});

const MODES = new Set(['chat', 'task', 'meeting', 'summary', 'assign', 'review', 'memo', 'bonus']);
const DUTIES = new Set(['', 'finance']);

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
    reports: str(p.reports, LIMITS.maxLongFieldChars, 'reports', { required: false }),
    bio: str(p.bio, LIMITS.maxLongFieldChars, 'bio', { required: false }),
    memory: str(p.memory, LIMITS.maxLongFieldChars, 'memory', { required: false }),
    duties: str(p.duties, LIMITS.maxFieldChars, 'duties', { required: false }),
  };

  if (!DUTIES.has(persona.duties)) throw new ValidationError('مسؤوليات غير معروفة');

  const c = body.company ?? {};
  const company = {
    name: str(c.name, LIMITS.maxFieldChars, 'company.name', { required: false }) || 'الوكالة',
    about: str(c.about, LIMITS.maxLongFieldChars, 'company.about', { required: false }),
    team: str(c.team, LIMITS.maxLongFieldChars, 'company.team', { required: false }),
    portfolio: str(c.portfolio, LIMITS.maxLongFieldChars, 'company.portfolio', { required: false }),
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
  assign:
    'أنت تدير فريقك وتكلّفه بمهام العمل. ستصلك قائمة أعضاء فريقك مع معرّف كل عضو ومسماه وتخصصه ومهامه المفتوحة. ' +
    'كلّف كل عضو بالعدد المطلوب من المهام، وكل مهمة مرتبطة مباشرة بمسماه الوظيفي وتخصصه وتخدم أهداف الوكالة. ' +
    'لا تكرر مهامه المفتوحة، واجعل كل وصف محدداً وقابلاً للتنفيذ في جلسة عمل واحدة، مع ذكر المُخرَج المطلوب بوضوح. ' +
    'أعد JSON فقط دون أي نص قبله أو بعده، بهذا الشكل: ' +
    '{"tasks":[{"empId":"معرّف العضو","title":"عنوان قصير","description":"المطلوب بالتفصيل","priority":"low أو medium أو high"}]}',
  review:
    'أنت مدير وصلك عمل سلّمه أحد أفراد فريقك. راجعه كما يراجع مدير حقيقي: هل نفّذ المطلوب، وهل هو واضح وصالح للاستخدام مع عميل؟ ' +
    'كن عادلاً: اعتمد العمل الجيد حتى لو لم يكن مثالياً، واطلب التعديل فقط عند نقص حقيقي يمكن إصلاحه. ' +
    'إذا اعتمدت العمل وكان متميزاً بوضوح (أفضل من المتوقع، وجاهزاً للعميل دون تعديل)، يمكنك ترشيح صاحبه لمكافأة، فيُرفع ترشيحك إلى الموارد البشرية ثم المالية ثم المدير التنفيذي ثم المالك. ' +
    'لا ترشّح للعمل الجيد العادي، فالمكافأة استثناء. ' +
    'أعد JSON فقط دون أي نص قبله أو بعده: {"decision":"approve أو revise","feedback":"ملاحظتك للموظف بصوتك في جملة إلى ثلاث جمل","bonus":true أو false,"bonusReason":"سبب الترشيح في جملة، أو نص فارغ"}',
  bonus:
    'وصلك طلب مكافأة لأحد الموظفين ضمن سلسلة الموافقات، ومعه بياناته وآراء من راجعه قبلك. قيّمه من زاوية مسؤوليتك الموضحة في الطلب، بإنصاف ودون مجاملة. ' +
    'لك أن توافق بنفس المبلغ أو بمبلغ أقل، أو ترفض مع ذكر السبب. لا ترفع المبلغ. ' +
    'أعد JSON فقط دون أي نص قبله أو بعده: {"decision":"approve أو reject","amount":المبلغ الذي توافق عليه رقماً,"note":"رأيك بصوتك في جملة أو جملتين"}',
  memo:
    'اكتب مذكرة داخلية موجزة ومهنية بصوتك إلى المالك والمدير التنفيذي، بناءً على الأرقام التي تصلك فقط ودون اختلاق أرقام جديدة. ' +
    'اذكر الإجمالي وأبرز البنود والملاحظات، وتوصية واحدة عملية. لا تتجاوز 150 كلمة.',
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
  if (persona.bio) lines.push(`نبذة عنك: ${persona.bio}`);
  if (persona.memory) lines.push(`من ذاكرتك في العمل: ${persona.memory}`);
  if (company.team) lines.push(`زملاؤك في الفريق: ${company.team}`);
  if (company.portfolio) lines.push(`مشاريع الوكالة الجارية مع العملاء: ${company.portfolio}`);
  lines.push(
    'تحدث بالعربية الفصحى المبسطة دائماً، بشخصيتك أنت، وبما يتناسب مع مستواك الوظيفي وصلاحياتك.',
    'إذا لم تتوفر لديك معلومة (أرقام حقيقية، بيانات عميل) فقل ذلك واقترح افتراضاً معقولاً بدلاً من اختلاق أرقام.',
    'تصرّف كموظف حقيقي في يوم عمل: لك رأيك وخبرتك وأسلوبك، وقد تختلف مع غيرك بأدب، وتذكر أعمالك السابقة حين تفيد. ' +
      'إذا سُئلت مباشرة هل أنت ذكاء اصطناعي فأجب بصدق أنك موظف افتراضي يعمل بالذكاء الاصطناعي.',
    MODE_INSTRUCTIONS[mode],
  );
  if (mode === 'chat' && persona.duties === 'finance') {
    lines.push(
      'أنت المسؤول عن الرواتب والخصومات والمكافآت والعمل الإضافي (الأوفرتايم) وزيادات الرواتب في الوكالة.',
      'إذا طلب منك المالك صراحةً تسجيل حركة مالية لموظف، فأكّد في جملة قصيرة ما ستسجّله، ثم اكتب لكل حركة سطراً بهذا الشكل بالضبط: ' +
        '[[مالية: النوع | اسم الموظف أو الكل | المبلغ أو عدد الساعات | السبب]] ' +
        'حيث النوع واحد من: خصم، مكافأة، أوفرتايم (الرقم عدد ساعات)، زيادة (زيادة دائمة على الراتب الشهري). ' +
        'اكتب الأرقام كأرقام فقط دون عملة. لا تكتب هذا السطر إلا عند طلب صريح من المالك، وإذا بدا لك الطلب مخالفاً للسياسة أو مبالغاً فيه فنبّه إليه بأدب قبل التنفيذ.',
    );
  }
  if (mode === 'chat' && persona.reports) {
    lines.push(
      `أنت مسؤول عن تكليف فريقك بالمهام. أعضاء فريقك: ${persona.reports}.`,
      'إذا طلب منك المالك صراحةً تكليف الفريق أو أحد أعضائه بمهام، فأكّد ذلك في جملة قصيرة، ' +
        'ثم اكتب في آخر سطر من ردك هذا الأمر بالضبط: [[تكليف: أسماء الموظفين مفصولة بفاصلة أو الكل | عدد المهام لكل موظف من 1 إلى 3 | موضوع المهام أو تركيزها كما طلب المالك، أو اتركه فارغاً]]. ' +
        'لا تكتب المهام نفسها في ردك، فستُطلب منك بعد ذلك. ولا تكتب هذا الأمر أبداً إلا عند طلب صريح بالتكليف.',
    );
  }
  return lines.join('\n');
}
