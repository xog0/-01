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
