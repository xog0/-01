import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChain, createBonusRequest, currentStage, decideStage, skipStage, ownerDecision, pendingForOwner, inReview,
} from '../public/js/approvals.js';
import { createFinance, payLine } from '../public/js/finance.js';
import { newId } from '../public/js/data.js';

function agency({ withHr = true } = {}) {
  const employees = [
    { id: 'ceo', name: 'حمو', dept: 'executive', level: 8, xp: 1000, salary: 35000 },
    { id: 'cfo', name: 'شيكا', dept: 'finance', level: 6, xp: 560, salary: 18000, managerId: 'ceo' },
    { id: 'sara', name: 'سارة', dept: 'strategy', level: 5, xp: 420, salary: 14000, managerId: 'ceo' },
    { id: 'khalid', name: 'خالد', dept: 'content', level: 3, xp: 195, salary: 9000, managerId: 'sara' },
    { id: 'dana', name: 'دانة', dept: 'hr', level: 0, xp: 0, salary: 3000, managerId: 'ceo' },
  ];
  if (withHr) employees.push({ id: 'hind', name: 'هند', dept: 'hr', level: 5, xp: 400, salary: 14000, managerId: 'ceo' });
  return { nextId: 1, employees, finance: createFinance(Date.UTC(2026, 10, 1)), bonusRequests: [] };
}
const trail = (req) => req.chain.map((s) => `${s.role}:${s.empId || '-'}:${s.decision}`);

test('the chain runs manager → HR → CFO → CEO → owner', () => {
  const s = agency();
  assert.deepEqual(trail({ chain: buildChain(s, 'khalid', 'sara') }),
    ['manager:sara:null', 'hr:hind:null', 'cfo:cfo:null', 'ceo:ceo:null', 'owner:-:null']);
});

test('missing roles, repeated people and self-review are skipped with a reason', () => {
  const noHr = agency({ withHr: false });
  const c1 = buildChain(noHr, 'khalid', 'sara');
  assert.equal(c1[1].decision, 'skipped');
  assert.match(c1[1].note, /لا يوجد مدير الموارد البشرية/); // an HR intern does not count
  const s = agency();
  const c2 = buildChain(s, 'sara', 'ceo'); // Hamo recommends Sara: he does not review again as CEO
  assert.deepEqual(trail({ chain: c2 }).slice(-2), ['ceo:ceo:skipped', 'owner:-:null']);
  const c3 = buildChain(s, 'cfo', 'ceo'); // Sheika's own bonus skips his own stage
  assert.equal(c3.find((x) => x.role === 'cfo').decision, 'skipped');
  assert.throws(() => buildChain(s, 'khalid', 'khalid'), /ترشيح النفس/);
});

test('reviewers may lower but never raise the amount; nothing is paid before the owner approves', () => {
  const s = agency();
  const req = createBonusRequest(s, { empId: 'khalid', recommenderId: 'sara', amount: 200, reason: 'حملة ممتازة', taskId: 't1', newId });
  assert.equal(currentStage(req).role, 'hr');
  decideStage(s, req, { decision: 'approve', amount: 500, note: 'عادلة' }); // tries to raise
  assert.equal(req.amount, 200);
  decideStage(s, req, { decision: 'approve', amount: 150, note: 'ضمن الميزانية بمبلغ أقل' });
  assert.equal(req.amount, 150);
  decideStage(s, req, { decision: 'approve', note: 'أرفعها للمالك' });
  assert.equal(req.status, 'awaiting_owner');
  assert.equal(pendingForOwner(s).length, 1);
  assert.equal(payLine(s, s.employees[3]).bonuses, 0); // still nothing in payroll
  assert.throws(() => decideStage(s, req, { decision: 'approve' }), /صندوق الموافقات/);
  const adj = ownerDecision(s, req, { approve: true });
  assert.equal(adj.amount, 150);
  assert.equal(adj.by, 'owner');
  assert.equal(req.status, 'approved');
  assert.equal(payLine(s, s.employees[3]).bonuses, 150);
  assert.throws(() => createBonusRequest(s, { empId: 'khalid', recommenderId: 'sara', amount: 100, taskId: 't1', newId }), /من قبل/);
});

test('a rejection anywhere closes the request; the owner can also reject or change the amount', () => {
  const s = agency();
  const a = createBonusRequest(s, { empId: 'khalid', recommenderId: 'sara', amount: 200, newId });
  decideStage(s, a, { decision: 'approve' });
  decideStage(s, a, { decision: 'reject', note: 'الرصيد لا يسمح هذا الشهر' });
  assert.equal(a.status, 'rejected');
  assert.equal(currentStage(a), null);
  assert.equal(inReview(s).length, 0);
  const b = createBonusRequest(s, { empId: 'khalid', recommenderId: 'sara', amount: 200, newId });
  for (let i = 0; i < 3; i++) decideStage(s, b, { decision: 'approve' });
  ownerDecision(s, b, { approve: false, note: 'لاحقاً' });
  assert.equal(b.status, 'rejected');
  assert.equal(payLine(s, s.employees[3]).bonuses, 0);
  const c = createBonusRequest(s, { empId: 'khalid', recommenderId: 'sara', amount: 200, newId });
  for (let i = 0; i < 3; i++) decideStage(s, c, { decision: 'approve' });
  ownerDecision(s, c, { approve: true, amount: 300 }); // the owner has the last word, up or down
  assert.equal(payLine(s, s.employees[3]).bonuses, 300);
});

test('a reviewer who left is skipped and the request moves on', () => {
  const s = agency();
  const req = createBonusRequest(s, { empId: 'khalid', recommenderId: 'sara', amount: 100, newId });
  skipStage(s, req, 'غادر الوكالة');
  assert.equal(currentStage(req).role, 'cfo');
});
