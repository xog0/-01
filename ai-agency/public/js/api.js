// Talks to the local server. If the server has no API key it answers
// {demo:true} and we generate a canned reply so the office still works.

export async function askEmployee(payload) {
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

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

async function demoReply({ mode, persona, messages }) {
  await new Promise((r) => setTimeout(r, 700 + Math.random() * 900));
  const last = messages.at(-1).content;
  const note = '\n\n(وضع تجريبي: أضف ANTHROPIC_API_KEY للخادم ليرد الموظف بذكاء حقيقي.)';
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
  if (mode === 'summary') {
    return `**القرارات:**\n- المضي في الفكرة الرئيسية مع اختبار مصغّر أولاً.\n\n**المهام:**\n- ${persona.name}: متابعة التنفيذ وإعداد تقرير.\n\n**الخطوة التالية:** اجتماع مراجعة بعد أسبوع.${note}`;
  }
  return pick([
    `أهلاً! أنا ${persona.name}، ${persona.title}. سؤال ممتاز، وأقترح أن نبدأ بخطوة صغيرة قابلة للقياس ثم نتوسع.`,
    `فهمت طلبك. من خبرتي في ${persona.department}، أهم شيء هنا هو وضوح الرسالة والجمهور المستهدف. هل تريد أن أجهّز مسودة؟`,
    `بالتأكيد. سأضع هذا ضمن أولوياتي وأشاركك النتيجة قريباً.`,
  ]) + note;
}
