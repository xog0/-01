import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateChatRequest, buildSystemPrompt, ValidationError, LIMITS } from '../public/js/prompt.js';

const persona = { name: 'سارة', title: 'مدير الاستراتيجية', level: 'مدير', department: 'الاستراتيجية' };
const base = (over = {}) => ({ mode: 'chat', persona, company: { name: 'آفاق' }, messages: [{ role: 'user', content: 'مرحبا' }], ...over });

test('accepts a valid chat request', () => {
  const r = validateChatRequest(base());
  assert.equal(r.mode, 'chat');
  assert.equal(r.persona.name, 'سارة');
  assert.deepEqual(r.messages, [{ role: 'user', content: 'مرحبا' }]);
});

test('rejects unknown mode, bad roles and missing persona fields', () => {
  assert.throws(() => validateChatRequest(base({ mode: 'hack' })), ValidationError);
  assert.throws(() => validateChatRequest(base({ messages: [{ role: 'system', content: 'x' }] })), ValidationError);
  assert.throws(() => validateChatRequest(base({ persona: { ...persona, name: '' } })), ValidationError);
  assert.throws(() => validateChatRequest(base({ persona: { ...persona, name: 42 } })), ValidationError);
  assert.throws(() => validateChatRequest(null), ValidationError);
});

test('rejects oversized fields', () => {
  const long = 'x'.repeat(LIMITS.maxMessageChars + 1);
  assert.throws(() => validateChatRequest(base({ messages: [{ role: 'user', content: long }] })), ValidationError);
  assert.throws(() => validateChatRequest(base({ persona: { ...persona, title: 'x'.repeat(500) } })), ValidationError);
});

test('history must end with the user; leading assistant turns are dropped', () => {
  assert.throws(() => validateChatRequest(base({ messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }] })), ValidationError);
  const r = validateChatRequest(base({ messages: [{ role: 'assistant', content: 'hi' }, { role: 'user', content: 'q' }] }));
  assert.deepEqual(r.messages, [{ role: 'user', content: 'q' }]);
});

test('merges consecutive same-role turns and caps history length', () => {
  const r = validateChatRequest(base({ messages: [{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }] }));
  assert.deepEqual(r.messages, [{ role: 'user', content: 'a\n\nb' }]);
  const many = Array.from({ length: 100 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
  many.push({ role: 'user', content: 'last' });
  const capped = validateChatRequest(base({ messages: many }));
  assert.ok(capped.messages.length <= LIMITS.maxHistory);
  assert.equal(capped.messages[0].role, 'user');
});

test('system prompt carries persona, company and mode instructions', () => {
  const req = validateChatRequest(base({ mode: 'task', persona: { ...persona, personality: 'هادئة' } }));
  const sys = buildSystemPrompt(req);
  assert.match(sys, /سارة/);
  assert.match(sys, /آفاق/);
  assert.match(sys, /هادئة/);
  assert.match(sys, /نفّذها الآن/);
});

test('assign mode asks the manager for JSON tasks tied to each role', () => {
  const sys = buildSystemPrompt(validateChatRequest(base({ mode: 'assign' })));
  assert.match(sys, /"tasks"/);
  assert.match(sys, /مسماه الوظيفي/);
});

test('a manager is told how to issue an assignment order only in chat', () => {
  const boss = { ...persona, reports: 'خالد (أخصائي أول كتابة المحتوى)' };
  assert.match(buildSystemPrompt(validateChatRequest(base({ persona: boss }))), /\[\[تكليف:/);
  assert.doesNotMatch(buildSystemPrompt(validateChatRequest(base({ persona: boss, mode: 'task' }))), /\[\[تكليف:/);
  assert.doesNotMatch(buildSystemPrompt(validateChatRequest(base())), /\[\[تكليف:/);
});

test('review mode asks for a JSON verdict; bio and memory reach the prompt', () => {
  const p = { ...persona, bio: 'عمرك 34 سنة', memory: 'آخر مهامك المنجزة: خطة الربع.' };
  const sys = buildSystemPrompt(validateChatRequest(base({ mode: 'review', persona: p })));
  assert.match(sys, /"decision"/);
  assert.match(sys, /عمرك 34 سنة/);
  assert.match(sys, /خطة الربع/);
  assert.throws(() => validateChatRequest(base({ persona: { ...persona, memory: 'x'.repeat(2000) } })), ValidationError);
});

test('only the finance manager is told how to record payroll orders', () => {
  const cfo = { ...persona, duties: 'finance' };
  assert.match(buildSystemPrompt(validateChatRequest(base({ persona: cfo }))), /\[\[مالية:/);
  assert.doesNotMatch(buildSystemPrompt(validateChatRequest(base())), /\[\[مالية:/);
  assert.doesNotMatch(buildSystemPrompt(validateChatRequest(base({ persona: cfo, mode: 'task' }))), /\[\[مالية:/);
  assert.throws(() => validateChatRequest(base({ persona: { ...persona, duties: 'admin' } })), ValidationError);
  assert.match(buildSystemPrompt(validateChatRequest(base({ mode: 'memo' }))), /مذكرة داخلية/);
});

test('the agency portfolio reaches the prompt and is length-checked', () => {
  const req = validateChatRequest(base({ company: { name: 'آفاق', portfolio: 'بيت الزعتر: حملة افتتاح (قيد التنفيذ)' } }));
  assert.match(buildSystemPrompt(req), /مشاريع الوكالة الجارية مع العملاء: بيت الزعتر/);
  assert.throws(() => validateChatRequest(base({ company: { name: 'آفاق', portfolio: 'x'.repeat(1300) } })), ValidationError);
});

test('reviews can recommend a bonus, and bonus reviewers answer in JSON without raising the amount', () => {
  assert.match(buildSystemPrompt(validateChatRequest(base({ mode: 'review' }))), /"bonus":true أو false/);
  const sys = buildSystemPrompt(validateChatRequest(base({ mode: 'bonus' })));
  assert.match(sys, /"decision":"approve أو reject"/);
  assert.match(sys, /لا ترفع المبلغ/);
});

test('evaluation mode asks for a fair JSON assessment with a fixed set of recommendations', () => {
  const sys = buildSystemPrompt(validateChatRequest(base({ mode: 'evaluation' })));
  assert.match(sys, /"recommendation":"promote أو bonus أو improve أو none"/);
  assert.match(sys, /دون اختلاق/);
});

test('a client persona is framed as a customer of the agency, not staff', () => {
  const client = { name: 'أبو فادي', title: 'المالك', level: 'عميل', department: 'مطعم بيت الزعتر', skills: 'مطاعم', duties: 'client', personality: 'ميزانيته محدودة' };
  const chat = buildSystemPrompt(validateChatRequest(base({ persona: client })));
  assert.match(chat, /أنت عميل لوكالة التسويق «آفاق» ولست موظفاً فيها/);
  assert.match(chat, /ميزانيته محدودة/);
  assert.doesNotMatch(chat, /تعمل بمسمى/);
  const review = buildSystemPrompt(validateChatRequest(base({ persona: client, mode: 'client_review' })));
  assert.match(review, /"decision":"approve أو changes"/);
  assert.match(review, /"satisfaction"/);
});

test('candidates mode asks for three distinct people as JSON; a candidate persona is an applicant, not staff', () => {
  const sys = buildSystemPrompt(validateChatRequest(base({ mode: 'candidates' })));
  assert.match(sys, /ثلاثة مرشحين/);
  assert.match(sys, /"candidates":\[\{"name"/);
  const cand = { name: 'ريم العتيبي', title: 'أخصائي تسويق', level: 'أخصائي', department: 'التسويق', duties: 'candidate',
    bio: 'العمر 29، خبرة 6 سنوات', personality: 'هادئة', memory: 'الراتب الذي تطلبه 11000' };
  const chat = buildSystemPrompt(validateChatRequest(base({ persona: cand })));
  assert.match(chat, /مرشح لوظيفة "أخصائي تسويق"/);
  assert.match(chat, /ولست موظفاً فيها بعد/);
  assert.match(chat, /الراتب الذي تطلبه 11000/);
  assert.doesNotMatch(chat, /تعمل بمسمى/);
  assert.throws(() => validateChatRequest(base({ persona: { ...cand, duties: 'admin' } })), /مسؤوليات غير معروفة/);
});

test('report mode sticks to the data it is given', () => {
  const sys = buildSystemPrompt(validateChatRequest(base({ mode: 'report' })));
  assert.match(sys, /خطة الصباح/);
  assert.match(sys, /التقرير الأسبوعي/);
  assert.match(sys, /دون اختلاق أرقام/);
});

test('sales modes: the sales head proposes prospects; a prospect answers a proposal', () => {
  const leads = buildSystemPrompt(validateChatRequest(base({ mode: 'leads' })));
  assert.match(leads, /ثلاثة عملاء محتملين/);
  assert.match(leads, /"leads":\[\{"name"/);
  const client = { name: 'سلطان', title: 'المدير التجاري', level: 'عميل', department: 'دروب للسفر', duties: 'client' };
  const review = buildSystemPrompt(validateChatRequest(base({ persona: client, mode: 'deal_review' })));
  assert.match(review, /"decision":"accept أو negotiate أو reject"/);
  assert.match(review, /ولست موظفاً فيها/);
});

test('the HR manager can grant leave, evaluate and hire on request, but not touch pay', () => {
  const hr = { name: 'نورة', title: 'مدير الموارد البشرية', level: 'مدير', department: 'الموارد البشرية', duties: 'hr' };
  const sys = buildSystemPrompt(validateChatRequest(base({ persona: hr })));
  assert.match(sys, /\[\[إجازة: اسم الموظف/);
  assert.match(sys, /\[\[تقييم:/);
  assert.match(sys, /\[\[توظيف:/);
  assert.match(sys, /تخفيض الراتب للمالك وحده/);
  assert.match(sys, /\[\[مكافأة:/);
  assert.match(sys, /\[\[وعد ترقية:/);
  assert.match(sys, /الحد الأقصى يحدده المالك/);
  const cand = { name: 'ريم', title: 'مصمم', level: 'أخصائي', department: 'التصميم', duties: 'candidate', manager: 'نورة (مدير الموارد البشرية)' };
  assert.match(buildSystemPrompt(validateChatRequest(base({ persona: cand }))), /مقابلة عمل مع نورة \(مدير الموارد البشرية\)/);
  assert.match(buildSystemPrompt(validateChatRequest(base({ persona: cand, mode: 'offer_reply' }))), /"decision":"accept أو counter أو reject"/);
  assert.match(buildSystemPrompt(validateChatRequest(base({ persona: hr, mode: 'rewards' }))), /"promotions":\[/);
  assert.match(buildSystemPrompt(validateChatRequest(base({ persona: hr, mode: 'hire_pick' }))), /"choice"/);
  assert.match(buildSystemPrompt(validateChatRequest(base({ persona: hr, mode: 'interview' }))), /سؤالاً واحداً فقط/);
  assert.doesNotMatch(buildSystemPrompt(validateChatRequest(base({ persona: { ...hr, duties: '' } }))), /\[\[إجازة:/);
});
