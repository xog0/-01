import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, libraryItems, itemsMarkdown, invoiceHtml, invoiceNumber, statementHtml, ledgerCsv } from '../public/js/docs.js';

const AT = Date.UTC(2026, 10, 20);
function agency() {
  return {
    company: { name: 'آفاق', about: 'وكالة تسويق' },
    employees: [{ id: 'e1', name: 'خالد' }, { id: 'e2', name: 'ليلى' }],
    clients: [{ id: 'c1', name: 'مقهى <الركن>', contact: 'سامي', city: 'جدة' }],
    projects: [{ id: 'p1', clientId: 'c1', name: 'حملة "الشتاء"', fee: 10000, paid: 4000, status: 'active' }],
    tasks: [
      { id: 't1', empId: 'e1', status: 'done', title: 'نصوص الشتاء', output: 'قهوة دافئة', doneAt: AT, projectId: 'p1', rating: 5 },
      { id: 't2', empId: 'e2', status: 'done', title: 'تقويم إنستغرام', output: 'خطة أسبوع', doneAt: AT + 1000 },
      { id: 't3', empId: 'e1', status: 'todo', title: 'لم تنجز', output: '' },
    ],
    meetings: [{ id: 'm1', topic: 'إطلاق', at: AT - 1000, attendees: ['e1'], summary: 'قرارات', log: [{ who: 'خالد', text: 'رأيي' }] }],
    finance: { currency: 'ر.س', ledger: [
      { id: 'l7', type: 'income', category: 'دفعة عميل', amount: 4000, at: AT, projectId: 'p1', note: '=SUM(A1) دفعة أولى' },
      { id: 'l8', type: 'expense', category: 'إعلانات', amount: 500, at: AT, note: 'ميتا, حملة' },
    ] },
  };
}

test('escapeHtml neutralises markup', () => {
  assert.equal(escapeHtml('<img src=x onerror="a">&\''), '&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;');
});

test('the library lists finished work and minutes, filters and searches', () => {
  const s = agency();
  assert.deepEqual(libraryItems(s).map((i) => i.id), ['t2', 't1', 'm1']);
  assert.deepEqual(libraryItems(s, { clientId: 'c1' }).map((i) => i.id), ['t1']);
  assert.deepEqual(libraryItems(s, { empId: 'e1' }).map((i) => i.id), ['t1', 'm1']);
  assert.deepEqual(libraryItems(s, { q: 'دافئة' }).map((i) => i.id), ['t1']);
  assert.deepEqual(libraryItems(s, { kind: 'meeting' }).map((i) => i.id), ['m1']);
  const opts = { nameOf: () => 'خالد', projectOf: (id) => (id ? { client: 'مقهى', name: 'حملة' } : null), agency: 'آفاق' };
  const one = itemsMarkdown(libraryItems(s, { clientId: 'c1' }), opts);
  assert.equal(one, '# نصوص الشتاء\n\n_خالد · مقهى · حملة · 2026-11-20 · تقييم 5/5_\n\nقهوة دافئة\n');
  const all = itemsMarkdown(libraryItems(s), opts);
  assert.match(all, /^# آفاق — مكتبة الأعمال\n\n## تقويم إنستغرام/);
  assert.match(all, /\n---\n\n## نصوص الشتاء\n\n_خالد · مقهى · حملة/);
  assert.match(all, /## محضر: إطلاق[\s\S]*خالد: رأيي/);
});

test('invoices and statements carry the right numbers and escape names', () => {
  const s = agency();
  const entry = s.finance.ledger[0];
  assert.equal(invoiceNumber(entry), 'INV-2026-0007');
  const inv = invoiceHtml(s, entry);
  assert.match(inv, /<html lang="ar" dir="rtl">/);
  assert.match(inv, /مقهى &lt;الركن&gt;/);
  assert.doesNotMatch(inv, /<الركن>/);
  assert.match(inv, /حملة &quot;الشتاء&quot;/);
  assert.match(inv, /الإجمالي: 4,000 ر.س/);
  assert.match(inv, /المتبقي 6,000/);
  const st = statementHtml(s, 'c1', AT);
  assert.match(st, /INV-2026-0007/);
  assert.match(st, /<td>قيد التنفيذ<\/td>/);
  assert.match(st, /إجمالي القيمة 10,000 · المدفوع 4,000 · المتبقي 6,000/);
});

test('the ledger CSV quotes commas and defuses spreadsheet formulas', () => {
  const csv = ledgerCsv(agency());
  assert.ok(csv.startsWith('﻿التاريخ,النوع,البند,المبلغ,ملاحظة'));
  assert.match(csv, /'=SUM\(A1\) دفعة أولى/);
  assert.match(csv, /"ميتا, حملة"/);
});
