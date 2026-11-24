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
