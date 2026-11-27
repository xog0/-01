import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEAVE_TYPES, addDays, attendanceOf, dayKey, endLeave, grantLeave, leaveBalance, leaveOn, markAttendance, parseCandidates,
  sampleCandidates, upcomingLeaves, validDay, parseHrOrders, promisePromotion, openPromise, closePromise, parseOfferReply, nextOffer, parsePick, parseRewards, parseMessageOrders,
} from '../public/js/hr.js';
import { createFinance, payrollPreview } from '../public/js/finance.js';
import { newId } from '../public/js/data.js';

const NOW = new Date(2026, 10, 25, 10).getTime(); // 25 Nov 2026, local time
function agency() {
  return {
    nextId: 1,
    employees: [
      { id: 'e1', name: 'خالد', salary: 9000, hiredAt: new Date(2026, 0, 1).getTime() },
      { id: 'e2', name: 'ليلى', salary: 6000, hiredAt: new Date(2026, 10, 24).getTime() },
    ],
    tasks: [], leaves: [], finance: createFinance(NOW),
  };
}

test('dates are calendar days', () => {
  assert.equal(dayKey(NOW), '2026-11-25');
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.ok(validDay('2026-02-28'));
  assert.ok(!validDay('2026-02-30'));
  assert.ok(!validDay('25/11/2026'));
});

test('granting leave: validation, overlap and yearly quota', () => {
  const s = agency();
  const opts = { newId, now: NOW };
  assert.throws(() => grantLeave(s, { empId: 'x', type: 'annual', from: '2026-11-26', days: 2 }, opts), /غير موجود/);
  assert.throws(() => grantLeave(s, { empId: 'e1', type: 'vacation', from: '2026-11-26', days: 2 }, opts), /غير معروف/);
  assert.throws(() => grantLeave(s, { empId: 'e1', type: 'annual', from: '2026-11-26', days: 0 }, opts), /من 1 إلى 30/);
  assert.throws(() => grantLeave(s, { empId: 'e1', type: 'annual', from: '2026-11-26', days: 2.5 }, opts), /من 1 إلى 30/);
  assert.throws(() => grantLeave(s, { empId: 'e1', type: 'annual', from: '2026-11-24', days: 2 }, opts), /يوم مضى/);
  const l = grantLeave(s, { empId: 'e1', type: 'annual', from: '2026-11-25', days: 5, reason: 'سفر' }, opts);
  assert.equal(l.to, '2026-11-29');
  assert.equal(leaveOn(s, 'e1', '2026-11-27'), l);
  assert.equal(leaveOn(s, 'e1', '2026-11-30'), null);
  assert.throws(() => grantLeave(s, { empId: 'e1', type: 'sick', from: '2026-11-29', days: 1 }, opts), /لدى خالد إجازة سنوية/);
  assert.deepEqual(leaveBalance(s, 'e1', 'annual', '2026'), { used: 5, quota: 21, left: 16 });
  assert.throws(() => grantLeave(s, { empId: 'e1', type: 'annual', from: '2026-12-01', days: 17 }, opts), /المتبقي 16 يوماً/);
  // Leave that spans the new year counts against each year separately.
  grantLeave(s, { empId: 'e1', type: 'annual', from: '2026-12-20', days: 20 }, opts);
  assert.equal(leaveBalance(s, 'e1', 'annual', '2026').used, 17);
  assert.equal(leaveBalance(s, 'e1', 'annual', '2027').used, 8);
  assert.deepEqual(upcomingLeaves(s, '2026-11-25').map((x) => x.from), ['2026-11-25', '2026-12-20']);
});

test('unpaid leave deducts a day of pay per day, and ending it early adjusts the deduction', () => {
  const s = agency();
  const l = grantLeave(s, { empId: 'e1', type: 'unpaid', from: '2026-11-25', days: 4 }, { newId, now: NOW });
  const adj = s.finance.adjustments.find((a) => a.id === l.adjustmentId);
  assert.equal(adj.type, 'deduction');
  assert.equal(adj.amount, 1200); // 9000 / 30 * 4
  assert.equal(payrollPreview(s).lines.find((x) => x.empId === 'e1').deductions, 1200);
  // Back after two days (from the 27th): the leave covered the 25th and 26th.
  const r = endLeave(s, l.id, { now: new Date(2026, 10, 27, 9).getTime() });
  assert.equal(r.cancelled, false);
  assert.equal(l.to, '2026-11-26');
  assert.equal(l.days, 2);
  assert.equal(adj.amount, 600);
  assert.throws(() => endLeave(s, l.id, { now: new Date(2026, 10, 28).getTime() }), /انتهت/);
  // Leave that has not started is cancelled with its deduction.
  const later = grantLeave(s, { empId: 'e2', type: 'unpaid', from: '2026-12-01', days: 3 }, { newId, now: NOW });
  assert.equal(endLeave(s, later.id, { now: NOW }).cancelled, true);
  assert.ok(!s.leaves.includes(later));
  assert.ok(!s.finance.adjustments.some((a) => a.id === later.adjustmentId));
  assert.equal(LEAVE_TYPES.unpaid.quota, null);
});

test('attendance: workdays since hire, present or on leave', () => {
  const s = agency();
  grantLeave(s, { empId: 'e1', type: 'sick', from: '2026-11-25', days: 1 }, { newId, now: new Date(2026, 10, 23).getTime() });
  markAttendance(s, '2026-11-23', ['e1']);
  markAttendance(s, '2026-11-24', ['e1', 'e2']);
  markAttendance(s, '2026-11-25', ['e2']);
  markAttendance(s, '2026-11-25', ['e1']); // a second workday the same day does not mark someone on leave as present
  assert.deepEqual(s.attendance['2026-11-25'], { present: ['e2'], leave: ['e1'] });
  assert.deepEqual(attendanceOf(s, 'e1', { now: NOW }), { workdays: 3, present: 2, leave: 1, absent: 0 });
  assert.deepEqual(attendanceOf(s, 'e2', { now: NOW }), { workdays: 2, present: 2, leave: 0, absent: 0 }); // hired on the 24th
  for (let i = 0; i < 100; i++) markAttendance(s, addDays('2027-01-01', i), []);
  assert.equal(Object.keys(s.attendance).length, 90);
});

test('candidates from the HR manager are sanitised; a fallback shortlist exists', () => {
  const reply = `إليك المرشحين:\n${JSON.stringify({
    note: 'أرشّح الأولى',
    candidates: [
      { name: 'ريم <b>العتيبي</b>', gender: 'أنثى', age: 31, years: 30, background: 'خبرة في وكالات', salary: 999999, style: 'هادئة' },
      { name: 'ريم <b>العتيبي</b>', gender: 'f', age: 25 },
      { name: 'ف', age: 40 },
      { name: 'يوسف الحربي', gender: 'm', age: 'غير معروف', salary: 100 },
      { name: 'سلمان', gender: 'm' },
    ],
  })}`;
  const r = parseCandidates(reply, { base: 10000, years: 5 });
  assert.equal(r.note, 'أرشّح الأولى');
  assert.deepEqual(r.candidates.map((c) => c.name), ['ريم العتيبي', 'يوسف الحربي', 'سلمان']);
  const [reem, yousef] = r.candidates;
  assert.equal(reem.gender, 'f');
  assert.equal(reem.years, 13); // never more than age - 18
  assert.equal(reem.salary, 14000); // capped at 140% of the level's base
  assert.equal(yousef.salary, 8000); // floored at 80%
  assert.equal(yousef.age, 27); // unknown age falls back to 22 + years
  const staff = parseCandidates(reply, { base: 10000, years: 5, taken: ['ريم العتيبي'] });
  assert.deepEqual(staff.candidates.map((c) => c.name), ['يوسف الحربي', 'سلمان']);
  assert.equal(parseCandidates('لا يوجد', { base: 1 }), null);
  assert.equal(parseCandidates('{"candidates":[]}', { base: 1 }), null);
  const f = sampleCandidates({ deptName: 'التسويق', years: 3, base: 10000, taken: ['يوسف الشمري'] });
  assert.equal(f.candidates.length, 3);
  assert.equal(new Set(f.candidates.map((c) => c.name)).size, 3);
  assert.ok(f.candidates.every((c) => c.salary >= 8000 && c.salary <= 14000 && c.background.includes('التسويق')));
});

test('the HR manager\'s orders are read from her reply and removed from it', () => {
  const staff = [{ id: 'e1', name: 'خالد' }, { id: 'e2', name: 'ليلى' }, { id: 'e3', name: 'عمر' }];
  const departments = { content: { name: 'المحتوى' }, design: { name: 'التصميم' } };
  const ladder = [{ name: 'متدرب' }, { name: 'أخصائي مبتدئ' }, { name: 'أخصائي' }, { name: 'أخصائي أول' }];
  const reply = 'حاضر، سأسجلها الآن.\n[[إجازة: ليلى | مرضية | ٣ | اليوم | زكام]]\n[[إجازة: عمر | بدون راتب | 2 | 2026-12-01 | ظرف خاص]]\n' +
    '[[إجازة: خالد | سنوية | 1 | غداً | ]]\n[[إنهاء إجازة: خالد]]\n[[تقييم: الكل]]\n[[تقييم: خالد وليلى]]\n[[توظيف: قسم التصميم | أخصائي أول]]\n' +
    '[[إجازة: شخص غير موجود | سنوية | 2 | اليوم | ]]\n[[توظيف: قسم الفضاء | متدرب]]';
  const { text, orders } = parseHrOrders(reply, staff, { today: '2026-11-25', departments, ladder });
  assert.equal(text, 'حاضر، سأسجلها الآن.');
  assert.deepEqual(orders, [
    { kind: 'leave', empId: 'e2', type: 'sick', days: 3, from: '2026-11-25', reason: 'زكام' },
    { kind: 'leave', empId: 'e3', type: 'unpaid', days: 2, from: '2026-12-01', reason: 'ظرف خاص' },
    { kind: 'leave', empId: 'e1', type: 'annual', days: 1, from: '2026-11-26', reason: '' },
    { kind: 'endLeave', empId: 'e1' },
    { kind: 'evaluate', empIds: ['e1', 'e2', 'e3'] },
    { kind: 'evaluate', empIds: ['e1', 'e2'] },
    { kind: 'hire', dept: 'design', level: 3, cap: null },
  ]);
});

test('bonus proposals, promotion promises and a salary cap in her orders', () => {
  const staff = [{ id: 'e1', name: 'خالد' }, { id: 'e2', name: 'ليلى' }];
  const departments = { design: { name: 'التصميم' } };
  const ladder = [{ name: 'متدرب' }, { name: 'أخصائي مبتدئ' }, { name: 'أخصائي' }];
  assert.deepEqual(parseHrOrders('[[تدريب: ليلى | صناعة الفيديو القصير]]', staff).orders, [{ kind: 'train', empId: 'e2', course: 'صناعة الفيديو القصير' }]);
  const { text, orders } = parseHrOrders('تم.\n[[مكافأة: خالد | ١٥٠٠ ريال | أنجز 6 مهام بتقييم ممتاز]]\n[[وعد ترقية: ليلى | إنهاء حملة لمسة بتقييم جيد جداً | أداؤها ثابت]]\n' +
    '[[توظيف: التصميم | أخصائي | 9,500]]\n[[مكافأة: خالد | صفر | لا شيء]]', staff, { departments, ladder });
  assert.equal(text, 'تم.');
  assert.deepEqual(orders, [
    { kind: 'bonus', empId: 'e1', amount: 1500, reason: 'أنجز 6 مهام بتقييم ممتاز' },
    { kind: 'promise', empId: 'e2', condition: 'إنهاء حملة لمسة بتقييم جيد جداً', reason: 'أداؤها ثابت' },
    { kind: 'hire', dept: 'design', level: 2, cap: 9500 },
  ]);
});

test('a promotion promise stays open until the owner keeps or cancels it', () => {
  const s = { nextId: 1, employees: [{ id: 'e1', name: 'خالد', level: 3 }, { id: 'h', name: 'نورة', level: 5 }, { id: 'top', name: 'حمو', level: 8 }] };
  assert.throws(() => promisePromotion(s, { empId: 'h', by: 'h', toLevel: 6 }, { newId }), /نفسه/);
  assert.throws(() => promisePromotion(s, { empId: 'top', by: 'h', toLevel: 9 }, { newId }), /الموظف غير موجود|أعلى مستوى/);
  const p = promisePromotion(s, { empId: 'e1', by: 'h', toLevel: 4, condition: 'إنهاء 5 مهام' }, { newId });
  assert.equal(openPromise(s, 'e1'), p);
  assert.throws(() => promisePromotion(s, { empId: 'e1', by: 'h', toLevel: 4 }, { newId }), /لم يُحسم/);
  closePromise(s, p.id, 'kept');
  assert.equal(openPromise(s, 'e1'), null);
  assert.throws(() => closePromise(s, p.id, 'cancelled'), /حُسم/);
});

test('salary negotiation never goes above the owner\'s cap', () => {
  assert.deepEqual(nextOffer({ asking: 10000, cap: 12000 }), { offer: 10000, final: false });
  assert.deepEqual(nextOffer({ asking: 15000, cap: 12000 }), { offer: 12000, final: true });
  assert.deepEqual(nextOffer({ asking: 10000, cap: 12000, offers: [10000], answer: { decision: 'accept' } }), { agreed: 10000 });
  assert.deepEqual(nextOffer({ asking: 10000, cap: 12000, offers: [10000], answer: { decision: 'counter', value: 11000 } }), { agreed: 11000 });
  assert.deepEqual(nextOffer({ asking: 10000, cap: 12000, offers: [10000], answer: { decision: 'counter', value: 14000 } }), { offer: 12000, final: true });
  assert.deepEqual(nextOffer({ asking: 15000, cap: 12000, offers: [12000], answer: { decision: 'counter', value: 13000 } }), { failed: true });
  assert.deepEqual(nextOffer({ asking: 10000, cap: 12000, offers: [10000], answer: { decision: 'reject' } }), { failed: true });
  assert.deepEqual(parseOfferReply('{"decision":"counter","value":"١٢٥٠٠","reply":"أطلب أكثر قليلاً"}'), { decision: 'counter', value: 12500, reply: 'أطلب أكثر قليلاً' });
  assert.equal(parseOfferReply('{"decision":"maybe"}'), null);
  const cands = [{ id: 'c1', name: 'ريم العتيبي', agreed: 11000 }, { id: 'c2', name: 'طارق الحربي', agreed: null }];
  assert.deepEqual(parsePick('{"choice":"ريم العتيبي","reason":"الأقوى"}', cands), { candId: 'c1', reason: 'الأقوى' });
  assert.equal(parsePick('{"choice":"طارق الحربي"}', cands), null); // no agreed salary, cannot be picked
});

test('her bonus and promotion review is matched to people and kept within limits', () => {
  const staff = [{ id: 'e1', name: 'خالد', salary: 8000 }, { id: 'e2', name: 'ليلى', salary: 6000 }, { id: 'h', name: 'نورة', salary: 15000 }];
  const r = parseRewards(JSON.stringify({ note: 'خالد الأفضل هذا الشهر', bonuses: [
    { name: 'خالد', amount: 5000, reason: '6 مهام بتقييم ممتاز' }, { name: 'خالد', amount: 100 }, { name: 'نورة', amount: 900 }, { name: 'سالم', amount: 300 }, { name: 'ليلى', amount: 0 },
  ], promotions: [{ name: 'ليلى', condition: 'إنهاء حملة لمسة', reason: 'تقدم ثابت' }] }), staff, { exclude: ['h'] });
  assert.equal(r.note, 'خالد الأفضل هذا الشهر');
  assert.deepEqual(r.bonuses, [{ empId: 'e1', amount: 2000, reason: '6 مهام بتقييم ممتاز' }]); // capped at a quarter of the salary
  assert.deepEqual(r.promotions, [{ empId: 'e2', condition: 'إنهاء حملة لمسة', reason: 'تقدم ثابت' }]);
  assert.equal(parseRewards('لا أقترح شيئاً', staff), null);
});

test('a manager\'s message orders go to the named team members only', () => {
  const team = [{ id: 'e2', name: 'خالد' }, { id: 'e3', name: 'ليلى' }];
  const r = parseMessageOrders('أبلغتهم.\n[[رسالة: خالد | جهّز مسودة الإعلان قبل الظهر | شكراً]]\n[[رسالة: الكل | اجتماع غداً 9 صباحاً]]\n[[رسالة: سالم | مرحبا]]', team);
  assert.equal(r.text, 'أبلغتهم.');
  assert.deepEqual(r.orders, [{ empIds: ['e2'], text: 'جهّز مسودة الإعلان قبل الظهر | شكراً' }, { empIds: ['e2', 'e3'], text: 'اجتماع غداً 9 صباحاً' }]);
});
