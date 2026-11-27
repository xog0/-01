// Chooses where employee replies come from:
//  1. On claude.ai (published Artifact): the page's `sample` capability asks
//     Claude with the viewer's own account. No API key involved.
//  2. Locally: the Node server (server.js), which holds ANTHROPIC_API_KEY.
//  3. Neither available: canned demo replies so the office still works.
import { validateChatRequest, buildSystemPrompt } from './prompt.js';

let samplePromise = null;
function getSample() {
  if (!window.claude?.use) return Promise.resolve(null);
  samplePromise ||= window.claude.use('sample').catch(() => null);
  return samplePromise;
}

export async function backendStatus() {
  if (window.claude?.use) {
    const sample = await getSample();
    return sample ? { ai: true, label: 'متصل بـ Claude' } : { ai: false, label: 'وضع تجريبي (Claude غير متاح هنا)' };
  }
  try {
    const s = await (await fetch('/api/status')).json();
    return s.ai ? { ai: true, label: 'متصل بالذكاء الاصطناعي' } : { ai: false, label: 'وضع تجريبي (بدون مفتاح API)' };
  } catch {
    return { ai: false, label: 'وضع تجريبي (الخادم غير متصل)' };
  }
}

export async function askEmployee(payload) {
  const sample = await getSample();
  if (sample) return askViaSample(sample, payload);
  if (window.claude?.use) return demoReply(payload);

  let res;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('تعذّر الاتصال بالخادم. تأكد أنه يعمل.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `خطأ من الخادم (${res.status})`);
  if (data.demo) return demoReply(payload);
  return data.truncated ? `${data.reply}\n\n(…توقف الرد لأنه طويل جداً)` : data.reply;
}

const TIERS = { chat: 'quick', meeting: 'quick', task: 'default', summary: 'default', assign: 'default', review: 'quick', memo: 'quick', bonus: 'quick', evaluation: 'quick', client_review: 'quick', candidates: 'quick', leads: 'quick', deal_review: 'quick', report: 'quick', interview: 'quick', offer_reply: 'quick', hire_pick: 'quick', rewards: 'quick', dm: 'quick' };

async function askViaSample(sample, payload) {
  const req = validateChatRequest(payload);
  const messages = req.messages.map((m) => ({ ...m }));
  // `sample` has no system field and remembers nothing, so the role brief
  // travels at the top of the first user turn on every call.
  messages[0].content = `تعليمات دورك (التزم بها طوال المحادثة):\n${buildSystemPrompt(req)}\n\n---\n\n${messages[0].content}`;
  try {
    const r = await sample(messages, { modelTier: TIERS[req.mode], cache: false });
    return r.truncated ? `${r.text}\n\n(…توقف الرد لأنه طويل جداً)` : r.text;
  } catch (err) {
    if (err?.code === 'not_granted') throw new Error('لم تسمح الصفحة باستخدام Claude. اسمح بذلك من قائمة الأذونات ثم أعد المحاولة.');
    if (err?.code === 'rate_limited') throw new Error('طلبات كثيرة في وقت قصير. انتظر قليلاً ثم أعد المحاولة.');
    throw new Error(err?.message || 'تعذّر الحصول على رد من Claude.');
  }
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

async function demoReply({ mode, persona, messages }) {
  await new Promise((r) => setTimeout(r, 700 + Math.random() * 900));
  const last = messages.at(-1).content;
  const note = '\n\n(وضع تجريبي: الردود هنا جاهزة وليست من الذكاء الاصطناعي.)';
  if (mode === 'task') {
    const title = (last.match(/المهمة:\s*(.+)/) || [])[1] || 'المهمة';
    return `سلّمت: مسودة أولى لـ"${title}".\n\n## الملخص\nهذه نسخة تجريبية من المُخرَج أعدّها ${persona.name} (${persona.title}).\n\n## المحتوى\n1. **تحديد الهدف:** ما النتيجة التي نريد قياسها؟\n2. **الجمهور:** من نخاطب تحديداً وما احتياجه؟\n3. **التنفيذ:** الخطوات والقنوات المقترحة.\n4. **القياس:** المؤشرات التي سنتابعها أسبوعياً.${note}`;
  }
  if (mode === 'meeting') {
    return pick([
      `من زاوية ${persona.department}، أقترح أن نبدأ بتحديد هدف واحد قابل للقياس لهذا الموضوع قبل الدخول في التفاصيل.`,
      `أتفق مع ما طُرح، وأضيف أن ${persona.department} يمكنه تجهيز نسخة أولية خلال يومين لنختبرها.`,
      `لدي تحفّظ بسيط: نحتاج بيانات أوضح عن الجمهور قبل أن نلتزم بالميزانية. يمكنني جمعها هذا الأسبوع.`,
    ]);
  }
  if (mode === 'assign') return ''; // the app falls back to each department's task library
  if (mode === 'memo') return `مذكرة الرواتب: تم إعداد المسير وفق الأرقام المرفقة. أوصي بمراجعة بند العمل الإضافي الشهر القادم.${note}`;
  if (persona.duties === 'hr' && /إجاز|اجاز/.test(last)) {
    const who = (last.match(/(?:لـ|ل)\s*([\u0600-\u06FF]{2,})/) || [])[1];
    const days = (last.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).match(/\d+/) || ['1'])[0];
    return who ? `حاضر، سأسجّلها الآن.\n[[إجازة: ${who} | ${/مرض/.test(last) ? 'مرضية' : 'سنوية'} | ${days} | اليوم | بطلب من المالك]]` : `حدد لي اسم الموظف وعدد الأيام من فضلك.${note}`;
  }
  if (persona.duties === 'hr' && /قيّم|قيم|تقييم/.test(last)) return 'حاضر، سأبدأ تقييم الفريق الآن.\n[[تقييم: الكل]]';
  if (persona.duties === 'finance' && /خصم|مكافأة|مكافاة|أوفرتايم|اوفرتايم|زيادة/.test(last)) {
    const m = last.match(/(خصم|مكافأة|مكافاة|أوفرتايم|اوفرتايم|زيادة)[^\d٠-٩]*([\d٠-٩]+)/);
    return m ? `حاضر، سأسجّلها الآن.\n[[مالية: ${m[1]} | ${(last.match(/(?:ل|من|على)\s*([\u0600-\u06FF]+)/) || [])[1] || 'الكل'} | ${m[2]} | بطلب من المالك]]` : `حدد لي الموظف والمبلغ من فضلك.${note}`;
  }
  if (mode === 'review') {
    return JSON.stringify(Math.random() < 0.3
      ? { decision: 'revise', feedback: 'بداية جيدة، لكن أضف أمثلة عملية أوضح وخطوة قياس واحدة على الأقل.' }
      : Math.random() < 0.5
        ? { decision: 'approve', feedback: 'عمل متميز وجاهز للعميل.', bonus: true, bonusReason: 'سلّم عملاً متميزاً جاهزاً للعميل من أول مرة.' }
        : { decision: 'approve', feedback: 'عمل واضح ومناسب. شكراً لك.', bonus: false });
  }
  if (mode === 'client_review') {
    return JSON.stringify(Math.random() < 0.35
      ? { decision: 'changes', feedback: 'العمل جيد، لكن أريد نبرة أقرب لزبائني وعرضاً أوضح للسعر.', satisfaction: 3 }
      : { decision: 'approve', feedback: 'ممتاز، هذا ما كنت أريده. شكراً لكم.', satisfaction: 5 });
  }
  if (mode === 'report') {
    if (last.includes('خطة الصباح')) return `**أولويات اليوم**\n- إنهاء المهام عالية الأولوية أولاً.\n- متابعة المشاريع القريبة من التسليم.\n\n**انتباه:** راجعوا المهام المتأخرة قبل الظهر.${note}`;
    if (last.includes('نهاية اليوم')) return `**ما أنجزناه اليوم**\n- سلّم الفريق مهامه المخطط لها.\n\n**خطة الغد**\n- استكمال المتبقي ومراجعة ملاحظات العملاء.${note}`;
    return `**الأسبوع باختصار**\n- تقدّم جيد في المشاريع الجارية.\n\n**توصيتان**\n1. التركيز على تحصيل المستحقات.\n2. متابعة الفرص في مرحلة التفاوض.${note}`;
  }
  if (mode === 'dm') return pick(['حاضر، سأبدأ عليها الآن وأبلغك عند الانتهاء.', 'وصلت، سأنجزها اليوم إن شاء الله.', 'فهمت. سؤال واحد: هل هناك موعد تسليم محدد؟']);
  if (mode === 'interview') return pick(['حدثني عن مشروع نجحت فيه وما دورك تحديداً؟', 'كيف تتصرف إذا طلب العميل تعديلات كثيرة قبل التسليم بيوم؟', 'ما نقطة ضعفك وكيف تعمل عليها؟']);
  if (mode === 'offer_reply') {
    const offer = Number((last.match(/العرض:\s*([\d.]+)/) || [])[1]) || 0;
    const ask = Number((persona.memory.match(/تطلبه\s*([\d.]+)/) || [])[1]) || offer;
    return JSON.stringify(offer >= ask ? { decision: 'accept', reply: 'أقبل العرض، شكراً لكم.' }
      : offer >= ask * 0.9 ? { decision: 'counter', value: Math.round((offer + ask) / 2), reply: 'أقدّر العرض، هل يمكن رفعه قليلاً؟' }
        : { decision: 'counter', value: ask, reply: 'أطلب الراتب الذي ذكرته لأنه يناسب خبرتي.' });
  }
  if (mode === 'hire_pick') return JSON.stringify({ choice: (last.match(/المرشح:\s*([^\n(]+)/) || [])[1]?.trim() || '', reason: 'الأنسب خبرةً وراتباً بين من اتفقنا معهم.' });
  if (mode === 'rewards') return JSON.stringify({ note: 'اقتراحاتي بناءً على الأرقام.', bonuses: [], promotions: [] });
  if (mode === 'candidates' || mode === 'leads') return ''; // the app falls back to a ready-made list
  if (mode === 'deal_review') {
    const r = Math.random();
    return JSON.stringify(r < 0.45 ? { decision: 'accept', feedback: 'العرض واضح ومناسب لنا. لنبدأ.' }
      : r < 0.85 ? { decision: 'negotiate', value: Math.round((Number((last.match(/السعر المعروض:\s*([\d.]+)/) || [])[1]) || 10000) * 0.85), feedback: 'العرض جيد لكن الميزانية أقل. هل يمكن تعديل السعر؟' }
        : { decision: 'reject', feedback: 'شكراً لكم، لكن الميزانية لا تسمح حالياً.' });
  }
  if (persona.duties === 'candidate') {
    return pick([
      `شكراً لوقتك. أنا ${persona.name}، وأرى أن خبرتي تناسب هذه الوظيفة، ويسعدني أن أشرح كيف عملت في مشاريع مشابهة.`,
      'نقطة ضعفي أنني أحياناً أطيل في التفاصيل، وأعمل على ذلك بتحديد وقت لكل مهمة.',
      'سؤالي: كيف يُقاس النجاح في هذه الوظيفة خلال أول ثلاثة أشهر؟',
    ]) + note;
  }
  if (persona.duties === 'client') {
    return pick([`أهلاً، معك ${persona.name}. كيف يسير مشروعنا؟`, 'أريد أن أرى نتائج واضحة هذا الشهر، وميزانيتي محدودة.', 'شكراً لكم، أنتظر الأعمال القادمة.']) + note;
  }
  if (mode === 'evaluation') {
    const rec = ['none', 'none', 'bonus', 'improve', 'promote'][Math.floor(Math.random() * 5)];
    return JSON.stringify({ summary: `أداء ${persona.name} مستقر ويلتزم بالمطلوب.`, strengths: 'الالتزام ووضوح العمل', improve: 'سرعة التسليم', recommendation: rec, reason: 'بناءً على الأرقام المرفقة' });
  }
  if (mode === 'bonus') {
    return JSON.stringify(Math.random() < 0.15
      ? { decision: 'reject', note: 'أفضّل تأجيلها للشهر القادم.' }
      : { decision: 'approve', note: 'أوافق، المكافأة مستحقة.' });
  }
  if (mode === 'summary') {
    return `**القرارات:**\n- المضي في الفكرة الرئيسية مع اختبار مصغّر أولاً.\n\n**المهام:**\n- ${persona.name}: متابعة التنفيذ وإعداد تقرير.\n\n**الخطوة التالية:** اجتماع مراجعة بعد أسبوع.${note}`;
  }
  if (persona.reports && /كلّ?ف|وزّ?ع|مهام|مهمة/.test(last)) {
    return `حاضر، سأكلّف الفريق الآن.\n[[تكليف: الكل | 2 | ]]`;
  }
  return pick([
    `أهلاً! أنا ${persona.name}، ${persona.title}. سؤال ممتاز، وأقترح أن نبدأ بخطوة صغيرة قابلة للقياس ثم نتوسع.`,
    `فهمت طلبك. من خبرتي في ${persona.department}، أهم شيء هنا هو وضوح الرسالة والجمهور المستهدف. هل تريد أن أجهّز مسودة؟`,
    `بالتأكيد. سأضع هذا ضمن أولوياتي وأشاركك النتيجة قريباً.`,
  ]) + note;
}
